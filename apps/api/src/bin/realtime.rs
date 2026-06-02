use lambda_runtime::{run, service_fn, tracing as lambda_tracing, Error, LambdaEvent};
use serde_json::Value;

// Skeleton — fleshed out in Phase 2 (WS broadcast) + Phase 3 (Web Push).
#[tokio::main]
async fn main() -> Result<(), Error> {
    lambda_tracing::init_default_subscriber();
    run(service_fn(|_event: LambdaEvent<Value>| async move {
        Ok::<Value, Error>(serde_json::json!({ "ok": true }))
    }))
    .await
}
