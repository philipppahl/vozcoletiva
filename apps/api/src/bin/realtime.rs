//! Realtime stream consumer (decisions 0028 + 0025 Phase B). Triggered by the
//! table's DynamoDB stream (INSERT-filtered) and fans new items out over two
//! transports:
//!
//!   • a new `Message`   → broadcast a `message.created` signal to every open
//!     WebSocket of the conversation's audience; and, for a DM, a Web Push to
//!     the peer (gated by their `direct_message` preference);
//!   • a new `InboxItem` → a Web Push to the recipient (gated by their per-kind
//!     preference). Channel messages notify only via inbox items (mention /
//!     reply), never on every message — calm notifications.
//!
//! Delivery is **best-effort**: the user's write already committed before the
//! stream fired, so a delivery failure is logged, never retried into a poison
//! batch. We always return Ok and swallow per-record errors.

use std::sync::Arc;

use aws_sdk_apigatewaymanagement::primitives::Blob;
use lambda_runtime::{run, service_fn, tracing as lambda_tracing, Error, LambdaEvent};
use serde_json::{json, Value};

use voz_api::push_send::{self, PushContent, SendOutcome, Vapid};
use voz_api::realtime::{self, InboxEvent, MessageEvent, StreamEntity};
use voz_api::repo::{connection, push};
use voz_api::state::AppState;

struct Ctx {
    state: AppState,
    apigw: aws_sdk_apigatewaymanagement::Client,
    http: reqwest::Client,
    /// `None` if the VAPID key couldn't be loaded — WS broadcast still works,
    /// only Web Push is degraded.
    vapid: Option<Vapid>,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    lambda_tracing::init_default_subscriber();

    let aws_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
    let table_name =
        std::env::var("TABLE_NAME").map_err(|_| Error::from("realtime: missing TABLE_NAME"))?;
    let ws_endpoint =
        std::env::var("WS_ENDPOINT").map_err(|_| Error::from("realtime: missing WS_ENDPOINT"))?;

    let state = AppState::for_stream(&aws_config, table_name);
    let apigw_conf = aws_sdk_apigatewaymanagement::config::Builder::from(&aws_config)
        .endpoint_url(ws_endpoint)
        .build();
    let apigw = aws_sdk_apigatewaymanagement::Client::from_conf(apigw_conf);

    let vapid = load_vapid(&aws_config).await;
    if vapid.is_none() {
        tracing::warn!(
            event = "vapid_unavailable",
            note = "web push disabled this cold start"
        );
    }

    let ctx = Arc::new(Ctx {
        state,
        apigw,
        http: reqwest::Client::new(),
        vapid,
    });
    run(service_fn(move |event: LambdaEvent<Value>| {
        let ctx = ctx.clone();
        async move {
            handle(&ctx, event.payload).await;
            Ok::<Value, Error>(json!({ "ok": true }))
        }
    }))
    .await
}

/// Read the VAPID private key (SSM SecureString) + subject at cold start.
async fn load_vapid(aws_config: &aws_config::SdkConfig) -> Option<Vapid> {
    let param = std::env::var("VAPID_PRIVATE_KEY_PARAM").ok()?;
    let subject = std::env::var("VAPID_SUBJECT").ok()?;
    let ssm = aws_sdk_ssm::Client::new(aws_config);
    let resp = ssm
        .get_parameter()
        .name(param)
        .with_decryption(true)
        .send()
        .await
        .ok()?;
    let key = resp.parameter?.value?;
    match Vapid::new(&key, subject) {
        Ok(v) => Some(v),
        Err(e) => {
            tracing::error!(event = "vapid_load_failed", error = %e);
            None
        }
    }
}

async fn handle(ctx: &Ctx, event: Value) {
    let records = event
        .get("Records")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for record in &records {
        if record.get("eventName").and_then(Value::as_str) != Some("INSERT") {
            continue;
        }
        let Some(new_image) = record.pointer("/dynamodb/NewImage") else {
            continue;
        };
        match realtime::classify(new_image) {
            StreamEntity::Message(ev) => deliver_message(ctx, &ev).await,
            StreamEntity::Inbox(ev) => deliver_inbox(ctx, &ev).await,
            StreamEntity::Other => {}
        }
    }
}

/// WS-broadcast a new message to its audience, and (for a DM) push the peer.
async fn deliver_message(ctx: &Ctx, ev: &MessageEvent) {
    let targets = match realtime::resolve_targets(&ctx.state, &ev.conversation_id).await {
        Ok(t) => t,
        Err(e) => {
            tracing::warn!(event = "targets_failed", error = %e);
            return;
        }
    };

    // 1. Live WS broadcast (thin signal).
    let payload = realtime::message_signal(ev);
    let mut delivered = 0usize;
    for user_id in &targets.audience {
        delivered += broadcast_to_user(ctx, user_id, &payload).await;
    }
    tracing::info!(
        event = "ws_broadcast",
        conversation_id = %ev.conversation_id,
        audience = targets.audience.len(),
        delivered,
    );

    // 2. DM push to the non-author participant (channels notify via inbox only).
    if let Some([a, b]) = &targets.dm_participants {
        let peer = if a == &ev.author_id { b } else { a };
        if peer != &ev.author_id {
            let prefs = match push::get_prefs(&ctx.state, peer).await {
                Ok(p) => p,
                Err(e) => {
                    tracing::warn!(event = "prefs_failed", error = %e);
                    return;
                }
            };
            if prefs.allows_dm() {
                // The notification's large icon is the sender's avatar.
                let icon = realtime::avatar_url(&ctx.state, &ev.author_id).await;
                push_to_user(
                    ctx,
                    peer,
                    &realtime::dm_push_content(ev, icon),
                    "direct_message",
                )
                .await;
            }
        }
    }
}

/// Push an inbox item to its recipient, honouring their per-kind preference.
async fn deliver_inbox(ctx: &Ctx, ev: &InboxEvent) {
    let prefs = match push::get_prefs(&ctx.state, &ev.recipient_id).await {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!(event = "prefs_failed", error = %e);
            return;
        }
    };
    if !prefs.allows(&ev.kind) {
        return;
    }
    // The notification's large icon is the actor's avatar, when known.
    let icon = match &ev.actor_id {
        Some(actor) => realtime::avatar_url(&ctx.state, actor).await,
        None => None,
    };
    push_to_user(
        ctx,
        &ev.recipient_id,
        &realtime::inbox_push_content(ev, icon),
        &ev.kind,
    )
    .await;
}

/// PostToConnection the signal to one user's sockets; returns how many landed.
/// Prunes a 410-Gone socket.
async fn broadcast_to_user(ctx: &Ctx, user_id: &str, payload: &str) -> usize {
    let conns = match connection::list_for_user(&ctx.state, user_id).await {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(event = "ws_conn_lookup_failed", error = %e);
            return 0;
        }
    };
    let mut n = 0;
    for conn in conns {
        match ctx
            .apigw
            .post_to_connection()
            .connection_id(&conn)
            .data(Blob::new(payload.as_bytes().to_vec()))
            .send()
            .await
        {
            Ok(_) => n += 1,
            Err(err) => {
                let se = err.into_service_error();
                if se.is_gone_exception() {
                    let _ = connection::remove_pair(&ctx.state, &conn, user_id).await;
                } else {
                    tracing::warn!(event = "ws_post_failed", error = %se);
                }
            }
        }
    }
    n
}

/// Web Push `content` to all of a user's subscriptions; prune dead endpoints.
async fn push_to_user(ctx: &Ctx, user_id: &str, content: &PushContent, kind: &str) {
    let Some(vapid) = &ctx.vapid else { return };
    let subs = match push::list_subscriptions(&ctx.state, user_id).await {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!(event = "push_sub_lookup_failed", error = %e);
            return;
        }
    };
    if subs.is_empty() {
        return;
    }
    let body = content.to_bytes();
    let mut delivered = 0usize;
    let mut pruned = 0usize;
    for sub in &subs {
        match push_send::send(&ctx.http, vapid, sub, &body).await {
            Ok(SendOutcome::Delivered) => delivered += 1,
            Ok(SendOutcome::Gone) => {
                let _ = push::delete_subscription(&ctx.state, user_id, &sub.endpoint).await;
                pruned += 1;
            }
            Err(e) => tracing::warn!(event = "push_send_failed", error = %e),
        }
    }
    // Counts + kind only — never the notification body (PII).
    tracing::info!(event = "push_sent", kind = kind, delivered, pruned);
}
