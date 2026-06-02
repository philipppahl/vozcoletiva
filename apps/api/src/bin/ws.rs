//! WebSocket Lambda (decision 0028). One bin, three jobs, branched on the event
//! shape API Gateway hands us:
//!
//!   • REQUEST authorizer  — validate the Cognito access token passed as the
//!     `?token=` query param on the handshake (browsers can't set headers on a
//!     WS upgrade), and return an Allow/Deny policy + a `userId` context.
//!   • `$connect`          — store the connection (the authorizer's `userId`).
//!   • `$disconnect`       — remove it (idempotent; resolves the owner itself).
//!   • `$default`          — client frames are ignored for now.

use chrono::Utc;
use lambda_runtime::{run, service_fn, tracing as lambda_tracing, Error, LambdaEvent};
use serde_json::{json, Value};

use voz_api::repo::connection;
use voz_api::state::AppState;

/// TTL backstop. API Gateway caps a socket at ~2 h; this guarantees a leaked
/// row (missed `$disconnect`) self-expires rather than lingering forever.
const TTL_SECS: i64 = 3 * 60 * 60;

#[tokio::main]
async fn main() -> Result<(), Error> {
    lambda_tracing::init_default_subscriber();
    let state = AppState::from_env()
        .await
        .map_err(|e| Error::from(format!("ws app state init: {e}")))?;
    run(service_fn(move |event: LambdaEvent<Value>| {
        let state = state.clone();
        async move { handle(&state, event.payload).await }
    }))
    .await
}

async fn handle(state: &AppState, event: Value) -> Result<Value, Error> {
    // The authorizer invocation is the only event carrying a `methodArn`.
    if let Some(method_arn) = event.get("methodArn").and_then(|v| v.as_str()) {
        return Ok(authorize(state, &event, method_arn).await);
    }

    let ctx = event.get("requestContext").cloned().unwrap_or(Value::Null);
    let connection_id = ctx
        .get("connectionId")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let event_type = ctx.get("eventType").and_then(|v| v.as_str()).unwrap_or("");

    match event_type {
        "CONNECT" => {
            let user_id = ctx
                .pointer("/authorizer/userId")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            if user_id.is_empty() || connection_id.is_empty() {
                return Ok(json!({ "statusCode": 401 }));
            }
            let now = Utc::now();
            let ttl = now.timestamp() + TTL_SECS;
            if let Err(e) =
                connection::add(state, &connection_id, &user_id, &now.to_rfc3339(), ttl).await
            {
                tracing::error!(event = "ws_connect_store_failed", error = %e);
                return Ok(json!({ "statusCode": 500 }));
            }
            // user_id is a Cognito sub (opaque id), not PII.
            tracing::info!(event = "ws_connected", user_id = %user_id);
            Ok(json!({ "statusCode": 200 }))
        }
        "DISCONNECT" => {
            if !connection_id.is_empty() {
                if let Err(e) = connection::remove(state, &connection_id).await {
                    tracing::error!(event = "ws_disconnect_cleanup_failed", error = %e);
                }
            }
            tracing::info!(event = "ws_disconnected");
            Ok(json!({ "statusCode": 200 }))
        }
        // $default — we don't accept client→server frames yet.
        _ => Ok(json!({ "statusCode": 200 })),
    }
}

/// REQUEST authorizer: verify `?token=` and return an IAM policy. On any failure
/// we return an explicit Deny (principal "anonymous") so API Gateway rejects the
/// handshake with 403 rather than 500.
async fn authorize(state: &AppState, event: &Value, method_arn: &str) -> Value {
    let token = event
        .pointer("/queryStringParameters/token")
        .and_then(|v| v.as_str());
    let user_id = match token {
        Some(t) => state.jwt.verify(t).await.ok().map(|u| u.user_id),
        None => None,
    };
    match user_id {
        Some(uid) => policy(&uid, "Allow", method_arn, Some(&uid)),
        None => policy("anonymous", "Deny", method_arn, None),
    }
}

fn policy(principal: &str, effect: &str, resource: &str, user_id: Option<&str>) -> Value {
    let mut doc = json!({
        "principalId": principal,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [{
                "Action": "execute-api:Invoke",
                "Effect": effect,
                "Resource": resource,
            }],
        },
    });
    if let Some(uid) = user_id {
        doc["context"] = json!({ "userId": uid });
    }
    doc
}
