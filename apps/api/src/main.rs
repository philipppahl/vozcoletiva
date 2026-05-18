use lambda_http::{run, service_fn, tracing as lambda_tracing, Error, Request, Response};

mod auth;
mod error;
mod handlers;
mod repo;
mod state;

use state::AppState;

#[tokio::main]
async fn main() -> Result<(), Error> {
    lambda_tracing::init_default_subscriber();

    let app_state = AppState::from_env()
        .await
        .map_err(|e| Error::from(format!("app state init failed: {e}")))?;

    run(service_fn(move |req: Request| {
        let state = app_state.clone();
        async move { route(state, req).await }
    }))
    .await
}

async fn route(state: AppState, event: Request) -> Result<Response<lambda_http::Body>, Error> {
    let path = event.uri().path();
    let method = event.method();

    tracing::info!(?method, ?path, "request_received");

    match (method.as_str(), path) {
        ("GET", "/v1/hello") => handlers::hello::handle().await,
        ("GET", "/v1/me") => handlers::me::handle(&state, event).await,
        _ => Ok(Response::builder()
            .status(404)
            .header("content-type", "application/json")
            .header("access-control-allow-origin", "*")
            .body(r#"{"error":"not_found"}"#.into())?),
    }
}
