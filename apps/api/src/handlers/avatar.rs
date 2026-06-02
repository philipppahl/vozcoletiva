//! Profile avatar upload/remove (decision 0029). The client sends an already
//! cropped + resized image (≤256 px WebP) as base64 in JSON — small enough to
//! go through the API (no API-Gateway binary config), keeping it API-first. We
//! re-validate type + size server-side (never trust the client), store it under
//! an immutable versioned key, and point the profile at it.

use aws_sdk_s3::primitives::ByteStream;
use base64ct::{Base64, Encoding};
use lambda_http::{Body, Error, Request, Response};
use serde::Deserialize;
use ulid::Ulid;

use crate::auth::{bearer_token, AuthenticatedUser};
use crate::error::AppError;
use crate::repo::user;
use crate::state::{AppState, MediaConfig};

/// Cap on the decoded image. The client ships ~256 px WebP (~15–30 KB); this is
/// generous headroom while still bounding abuse.
const MAX_BYTES: usize = 512 * 1024;

#[derive(Debug, Deserialize)]
struct UploadBody {
    /// Standard base64 (with padding) of the image bytes.
    data: String,
}

/// `POST /v1/me/avatar`
pub async fn upload(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let (media, s3, bucket) = media_writer(state)?;

            let body: UploadBody = parse_body(&req)?;
            let bytes = Base64::decode_vec(body.data.trim())
                .map_err(|_| AppError::BadRequest("avatar data is not valid base64".into()))?;
            if bytes.is_empty() {
                return Err(AppError::BadRequest("avatar is empty".into()));
            }
            if bytes.len() > MAX_BYTES {
                return Err(AppError::BadRequest("avatar exceeds the size limit".into()));
            }
            let content_type = sniff_image(&bytes)
                .ok_or_else(|| AppError::BadRequest("avatar must be PNG, JPEG or WebP".into()))?;

            let key = format!(
                "avatars/{}/{}.{}",
                user.user_id,
                Ulid::new(),
                ext_for(content_type)
            );
            s3.put_object()
                .bucket(bucket)
                .key(&key)
                .body(ByteStream::from(bytes))
                .content_type(content_type)
                .cache_control("public, max-age=31536000, immutable")
                .send()
                .await
                .map_err(|e| AppError::Internal(Box::new(e.into_service_error())))?;

            // Point the profile at the new object; clean up the previous one.
            let previous = user::set_avatar(state, &user.user_id, &key).await?;
            if let Some(old_key) = previous {
                let _ = s3.delete_object().bucket(bucket).key(old_key).send().await;
            }
            tracing::info!(event = "avatar_set", user_id = %user.user_id);
            Ok(serde_json::json!({ "avatar_url": media.url_for(&key) }))
        },
        200,
    )
    .await
}

/// `DELETE /v1/me/avatar`
pub async fn delete(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let removed = user::clear_avatar(state, &user.user_id).await?;
            if let (Some(old_key), Ok((_, s3, bucket))) = (removed, media_writer(state)) {
                let _ = s3.delete_object().bucket(bucket).key(old_key).send().await;
            }
            tracing::info!(event = "avatar_removed", user_id = %user.user_id);
            Ok(serde_json::json!({ "ok": true }))
        },
        200,
    )
    .await
}

/// The media config + an S3 client + bucket, or an error if media isn't wired.
fn media_writer(state: &AppState) -> Result<(&MediaConfig, &aws_sdk_s3::Client, &str), AppError> {
    let media = state.media.as_ref().ok_or_else(|| {
        AppError::Internal(Box::new(std::io::Error::other("media not configured")))
    })?;
    let s3 = media.s3.as_deref().ok_or_else(|| {
        AppError::Internal(Box::new(std::io::Error::other("media S3 not configured")))
    })?;
    let bucket = media.bucket.as_deref().ok_or_else(|| {
        AppError::Internal(Box::new(std::io::Error::other(
            "media bucket not configured",
        )))
    })?;
    Ok((media, s3, bucket))
}

/// Identify the image by magic bytes — never trust a client-declared type.
fn sniff_image(b: &[u8]) -> Option<&'static str> {
    if b.len() >= 12 && &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        Some("image/webp")
    } else if b.starts_with(&[0x89, b'P', b'N', b'G']) {
        Some("image/png")
    } else if b.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some("image/jpeg")
    } else {
        None
    }
}

fn ext_for(content_type: &str) -> &'static str {
    match content_type {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        _ => "webp",
    }
}

async fn authenticate(state: &AppState, req: &Request) -> Result<AuthenticatedUser, AppError> {
    let token = bearer_token(req)?;
    state.jwt.verify(token).await
}

fn parse_body<T: for<'de> Deserialize<'de>>(req: &Request) -> Result<T, AppError> {
    serde_json::from_slice(req.body().as_ref())
        .map_err(|e| AppError::BadRequest(format!("invalid request body: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sniffs_supported_image_types() {
        let webp = [b"RIFF".as_slice(), &[0, 0, 0, 0], b"WEBP".as_slice()].concat();
        assert_eq!(sniff_image(&webp), Some("image/webp"));
        assert_eq!(
            sniff_image(&[0x89, b'P', b'N', b'G', 0x0d]),
            Some("image/png")
        );
        assert_eq!(sniff_image(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("image/jpeg"));
    }

    #[test]
    fn rejects_non_images() {
        assert_eq!(sniff_image(b"<html>hello"), None);
        assert_eq!(sniff_image(&[0x00, 0x01, 0x02]), None);
        assert_eq!(sniff_image(b""), None);
    }

    #[test]
    fn extension_follows_type() {
        assert_eq!(ext_for("image/png"), "png");
        assert_eq!(ext_for("image/jpeg"), "jpg");
        assert_eq!(ext_for("image/webp"), "webp");
    }
}
