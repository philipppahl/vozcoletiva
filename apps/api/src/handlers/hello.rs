use lambda_http::{Body, Error, Response};
use serde::Serialize;

/// The build version, baked in at compile time. Lambda invocations expose this so
/// the FE can see which build it is talking to.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Serialize)]
pub struct Hello {
    pub ok: bool,
    pub version: &'static str,
}

pub async fn handle() -> Result<Response<Body>, Error> {
    tracing::info!(event = "hello_called");

    let body = Hello {
        ok: true,
        version: VERSION,
    };

    Ok(Response::builder()
        .status(200)
        .header("content-type", "application/json")
        .header("access-control-allow-origin", "*")
        .body(serde_json::to_string(&body)?.into())?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn hello_returns_ok_true_and_version() {
        let response = handle().await.expect("hello handler should not fail");

        assert_eq!(response.status(), 200);
        assert_eq!(
            response.headers().get("content-type").unwrap(),
            "application/json"
        );

        let body_bytes = match response.body() {
            Body::Text(s) => s.as_bytes().to_vec(),
            Body::Binary(b) => b.clone(),
            Body::Empty => Vec::new(),
        };
        let parsed: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(parsed["ok"], serde_json::json!(true));
        assert_eq!(parsed["version"], serde_json::json!(VERSION));

        assert_eq!(
            response.headers().get("access-control-allow-origin").unwrap(),
            "*",
        );
    }
}
