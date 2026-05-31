use lambda_http::{Body, Error, Response};
use serde::Serialize;

use crate::error::AppError;

pub mod categories;
pub mod comments;
pub mod conversations;
pub mod documents;
pub mod hello;
pub mod inbox;
pub mod invites;
pub mod me;
pub mod members;
pub mod projects;
pub mod proposals;
pub mod votes;

/// Run `f` and shape its result into a JSON response. Successful results return
/// `status` and the body's JSON. `AppError` returns its mapped status + a
/// `{ error, message }` body. Every response carries the CORS header.
pub async fn json_or_error<T, F>(f: F, success_status: u16) -> Result<Response<Body>, Error>
where
    T: Serialize,
    F: std::future::Future<Output = Result<T, AppError>>,
{
    match f.await {
        Ok(value) => Ok(Response::builder()
            .status(success_status)
            .header("content-type", "application/json")
            .header("access-control-allow-origin", "*")
            .body(serde_json::to_string(&value)?.into())?),
        Err(err) => {
            tracing::warn!(error = %err, status = err.status(), code = err.code(), "request_failed");
            let body = serde_json::json!({
                "error": err.code(),
                "message": err.to_string(),
            });
            Ok(Response::builder()
                .status(err.status())
                .header("content-type", "application/json")
                .header("access-control-allow-origin", "*")
                .body(serde_json::to_string(&body)?.into())?)
        }
    }
}
