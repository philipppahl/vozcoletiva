use lambda_http::{Body, Error, Request, Response};
use serde::Serialize;

use crate::auth::{bearer_token, AuthenticatedUser};
use crate::error::AppError;
use crate::repo::user::{self, UserProfile};
use crate::state::AppState;

#[derive(Debug, Serialize)]
struct MeResponse {
    user_id: String,
    display_name: String,
    locale: String,
    theme: String,
    created_at: String,
}

impl From<UserProfile> for MeResponse {
    fn from(p: UserProfile) -> Self {
        Self {
            user_id: p.user_id,
            display_name: p.display_name,
            locale: p.locale,
            theme: p.theme,
            created_at: p.created_at.to_rfc3339(),
        }
    }
}

/// `GET /v1/me`
///
/// Authenticates the bearer access token, then returns (creating if necessary)
/// the user's profile. The display name on first call comes from the `display_name`
/// query parameter the sign-up flow appends to the first call; absent that, it
/// defaults to the local-part of the user id (which is the Cognito sub — opaque).
pub async fn handle(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    match handle_inner(state, req).await {
        Ok(profile) => json_response(200, &MeResponse::from(profile)),
        Err(err) => error_response(err),
    }
}

async fn handle_inner(state: &AppState, req: Request) -> Result<UserProfile, AppError> {
    let token = bearer_token(&req)?;
    let AuthenticatedUser { user_id } = state.jwt.verify(token).await?;
    tracing::info!(event = "me_called", user_id = %user_id);

    let fallback_name = display_name_hint(&req).unwrap_or_else(|| user_id.clone());
    user::get_or_create_profile(state, &user_id, &fallback_name).await
}

fn display_name_hint(req: &Request) -> Option<String> {
    let query = req.uri().query()?;
    for pair in query.split('&') {
        let (key, value) = pair.split_once('=')?;
        if key == "display_name" {
            return urlencoding_decode(value).ok();
        }
    }
    None
}

fn urlencoding_decode(s: &str) -> Result<String, ()> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b'%' if i + 2 < bytes.len() => {
                let hi = hex(bytes[i + 1])?;
                let lo = hex(bytes[i + 2])?;
                out.push((hi << 4) | lo);
                i += 3;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8(out).map_err(|_| ())
}

fn hex(b: u8) -> Result<u8, ()> {
    match b {
        b'0'..=b'9' => Ok(b - b'0'),
        b'a'..=b'f' => Ok(b - b'a' + 10),
        b'A'..=b'F' => Ok(b - b'A' + 10),
        _ => Err(()),
    }
}

fn json_response<T: Serialize>(status: u16, body: &T) -> Result<Response<Body>, Error> {
    Ok(Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .header("access-control-allow-origin", "*")
        .body(serde_json::to_string(body)?.into())?)
}

fn error_response(err: AppError) -> Result<Response<Body>, Error> {
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
