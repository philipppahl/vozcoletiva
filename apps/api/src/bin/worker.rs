use lambda_runtime::{run, service_fn, tracing as lambda_tracing, Error, LambdaEvent};
use serde::Deserialize;

use voz_api::jobs;
use voz_api::state::AppState;

#[derive(Debug, Deserialize)]
struct Event {
    proposal_id: String,
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    lambda_tracing::init_default_subscriber();
    let app_state = AppState::from_env()
        .await
        .map_err(|e| Error::from(format!("worker app state init: {e}")))?;

    run(service_fn(move |event: LambdaEvent<Event>| {
        let state = app_state.clone();
        async move {
            let proposal_id = event.payload.proposal_id;
            tracing::info!(event = "worker_invoked", proposal_id = %proposal_id);
            let changed = jobs::close_proposal::close(&state, &proposal_id)
                .await
                .map_err(|e| Error::from(format!("close failed: {e}")))?;
            Ok::<_, Error>(serde_json::json!({
                "proposal_id": proposal_id,
                "closed": changed,
            }))
        }
    }))
    .await
}
