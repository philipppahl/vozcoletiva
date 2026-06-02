//! Presigned upload URLs for chat media (decision: chat attachments). The client
//! asks for a short-lived S3 PUT URL, uploads the bytes directly to S3, then
//! posts the message referencing the returned `key`. Keeps large media off the
//! API request path while staying API-first (the URL is server-issued).

use std::time::Duration;

use aws_sdk_s3::presigning::PresigningConfig;
use lambda_http::{Body, Error, Request, Response};
use serde::Deserialize;
use ulid::Ulid;

use crate::auth::bearer_token;
use crate::error::AppError;
use crate::state::AppState;

/// Presigned PUT URLs are valid briefly — just long enough to upload.
const PRESIGN_SECS: u64 = 300;

#[derive(Debug, Deserialize)]
struct UploadReq {
    /// The exact Content-Type the client will PUT (signed in, so it's enforced).
    content_type: String,
    /// File extension without the dot (e.g. `jpg`, `pdf`, `webm`). Sanitised.
    ext: String,
}

/// `POST /v1/uploads`
pub async fn create(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let token = bearer_token(&req)?;
            state.jwt.verify(token).await?;

            let media = state.media.as_ref().ok_or_else(not_configured)?;
            let s3 = media.s3.as_deref().ok_or_else(not_configured)?;
            let bucket = media.bucket.as_deref().ok_or_else(not_configured)?;

            let body: UploadReq = parse_body(&req)?;
            if !valid_content_type(&body.content_type) {
                return Err(AppError::BadRequest("unsupported content type".into()));
            }
            let key = format!("chat/{}.{}", Ulid::new(), sanitize_ext(&body.ext));

            let presigned = s3
                .put_object()
                .bucket(bucket)
                .key(&key)
                .content_type(&body.content_type)
                .presigned(
                    PresigningConfig::expires_in(Duration::from_secs(PRESIGN_SECS))
                        .map_err(|e| AppError::Internal(Box::new(e)))?,
                )
                .await
                .map_err(|e| AppError::Internal(Box::new(e.into_service_error())))?;

            tracing::info!(event = "upload_presigned", content_type = %body.content_type);
            Ok(serde_json::json!({
                "put_url": presigned.uri().to_string(),
                "key": key,
                "url": media.url_for(&key),
            }))
        },
        200,
    )
    .await
}

fn not_configured() -> AppError {
    AppError::Internal(Box::new(std::io::Error::other("media not configured")))
}

/// Images, audio (voice notes), and a small document allow-list.
fn valid_content_type(ct: &str) -> bool {
    if ct.len() > 100 {
        return false;
    }
    ct.starts_with("image/")
        || ct.starts_with("audio/")
        || matches!(
            ct,
            "application/pdf"
                | "text/plain"
                | "text/csv"
                | "application/zip"
                | "application/msword"
                | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                | "application/octet-stream"
        )
}

fn sanitize_ext(ext: &str) -> String {
    let cleaned: String = ext
        .chars()
        .filter(char::is_ascii_alphanumeric)
        .take(8)
        .collect::<String>()
        .to_lowercase();
    if cleaned.is_empty() {
        "bin".to_string()
    } else {
        cleaned
    }
}

fn parse_body<T: for<'de> Deserialize<'de>>(req: &Request) -> Result<T, AppError> {
    serde_json::from_slice(req.body().as_ref())
        .map_err(|e| AppError::BadRequest(format!("invalid request body: {e}")))
}
