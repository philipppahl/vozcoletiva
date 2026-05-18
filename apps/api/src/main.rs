use lambda_http::{run, service_fn, tracing as lambda_tracing, Error, Request, Response};

mod error;
mod handlers;

#[tokio::main]
async fn main() -> Result<(), Error> {
    lambda_tracing::init_default_subscriber();

    run(service_fn(route)).await
}

async fn route(event: Request) -> Result<Response<lambda_http::Body>, Error> {
    let path = event.uri().path();
    let method = event.method();

    tracing::info!(?method, ?path, "request_received");

    match (method.as_str(), path) {
        ("GET", "/v1/hello") => handlers::hello::handle().await,
        _ => Ok(Response::builder()
            .status(404)
            .header("content-type", "application/json")
            .body(r#"{"error":"not_found"}"#.into())?),
    }
}
