//! Realtime stream consumer (decisions 0028 + 0025 Phase B). Triggered by the
//! table's DynamoDB stream (INSERT-filtered) and fans new items out over two
//! transports:
//!
//!   • a new `Message`   → broadcast a `message.created` signal to every open
//!     WebSocket of the conversation's audience (this file, Phase 2);
//!   • a new `InboxItem` → a Web Push to the recipient (Phase 3, to come).
//!
//! Delivery is **best-effort**: the user's write already committed before the
//! stream fired, so a delivery failure is logged, never retried into a poison
//! batch. We always return Ok and swallow per-record errors.

use std::sync::Arc;

use aws_sdk_apigatewaymanagement::primitives::Blob;
use lambda_runtime::{run, service_fn, tracing as lambda_tracing, Error, LambdaEvent};
use serde_json::{json, Value};

use voz_api::realtime::{self, StreamEntity};
use voz_api::repo::connection;
use voz_api::state::AppState;

struct Ctx {
    state: AppState,
    apigw: aws_sdk_apigatewaymanagement::Client,
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
    // The Management API client posts to the per-stage @connections endpoint.
    let apigw_conf = aws_sdk_apigatewaymanagement::config::Builder::from(&aws_config)
        .endpoint_url(ws_endpoint)
        .build();
    let apigw = aws_sdk_apigatewaymanagement::Client::from_conf(apigw_conf);

    let ctx = Arc::new(Ctx { state, apigw });
    run(service_fn(move |event: LambdaEvent<Value>| {
        let ctx = ctx.clone();
        async move {
            handle(&ctx, event.payload).await;
            Ok::<Value, Error>(json!({ "ok": true }))
        }
    }))
    .await
}

async fn handle(ctx: &Ctx, event: Value) {
    let records = event
        .get("Records")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for record in &records {
        // The event source is INSERT-filtered, but be defensive.
        if record.get("eventName").and_then(Value::as_str) != Some("INSERT") {
            continue;
        }
        let Some(new_image) = record.pointer("/dynamodb/NewImage") else {
            continue;
        };
        match realtime::classify(new_image) {
            StreamEntity::Message(ev) => broadcast_message(ctx, &ev).await,
            // Web Push is wired in Phase 3.
            StreamEntity::Inbox(_) | StreamEntity::Other => {}
        }
    }
}

/// Push a `message.created` signal to every open socket of the conversation's
/// audience. Prunes a connection that returns 410 Gone.
async fn broadcast_message(ctx: &Ctx, ev: &realtime::MessageEvent) {
    let audience = match realtime::broadcast_audience(&ctx.state, &ev.conversation_id).await {
        Ok(a) => a,
        Err(e) => {
            tracing::warn!(event = "ws_audience_failed", error = %e);
            return;
        }
    };
    let payload = realtime::message_signal(ev);
    let mut delivered = 0usize;
    for user_id in &audience {
        let conns = match connection::list_for_user(&ctx.state, user_id).await {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!(event = "ws_conn_lookup_failed", error = %e);
                continue;
            }
        };
        for conn in conns {
            match ctx
                .apigw
                .post_to_connection()
                .connection_id(&conn)
                .data(Blob::new(payload.clone().into_bytes()))
                .send()
                .await
            {
                Ok(_) => delivered += 1,
                Err(err) => {
                    let se = err.into_service_error();
                    if se.is_gone_exception() {
                        // Stale socket — drop both directional items.
                        let _ = connection::remove_pair(&ctx.state, &conn, user_id).await;
                    } else {
                        tracing::warn!(event = "ws_post_failed", error = %se);
                    }
                }
            }
        }
    }
    // Counts only — never the message body (PII).
    tracing::info!(
        event = "ws_broadcast",
        conversation_id = %ev.conversation_id,
        audience = audience.len(),
        delivered,
    );
}
