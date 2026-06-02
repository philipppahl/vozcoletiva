use lambda_http::{Body, Error, Request, Response};
use serde::{Deserialize, Serialize};

use crate::auth::{bearer_token, AuthenticatedUser};
use crate::domain::display_name::validate_display_name;
use crate::error::AppError;
use crate::repo::user::{self, UserProfile};
use crate::state::{AppState, MediaConfig};

#[derive(Debug, Serialize)]
struct MeResponse {
    user_id: String,
    display_name: String,
    locale: String,
    theme: String,
    created_at: String,
    /// Public CDN URL of the avatar, or null if none is set.
    avatar_url: Option<String>,
}

impl MeResponse {
    fn from_profile(p: UserProfile, media: Option<&MediaConfig>) -> Self {
        let avatar_url = avatar_url(&p, media);
        Self {
            user_id: p.user_id,
            display_name: p.display_name,
            locale: p.locale,
            theme: p.theme,
            created_at: p.created_at.to_rfc3339(),
            avatar_url,
        }
    }
}

/// Derive a profile's public avatar URL from its key + the media config.
pub fn avatar_url(p: &UserProfile, media: Option<&MediaConfig>) -> Option<String> {
    match (media, p.avatar_key.as_ref()) {
        (Some(m), Some(key)) => Some(m.url_for(key)),
        _ => None,
    }
}

#[derive(Debug, Deserialize)]
struct UpdateProfileBody {
    display_name: String,
}

/// `GET /v1/me`
///
/// Authenticates the bearer access token and returns the user's profile,
/// creating it on first call. Cognito is auth-only — the display name is set via
/// `PATCH /v1/me` (the sign-up flow bootstraps it), so a profile created here
/// before that bootstrap defaults its display name to the opaque user id until
/// the first `PATCH`. See decision 0019.
pub async fn handle(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    match handle_inner(state, req).await {
        Ok(profile) => json_response(
            200,
            &MeResponse::from_profile(profile, state.media.as_ref()),
        ),
        Err(err) => error_response(err),
    }
}

async fn handle_inner(state: &AppState, req: Request) -> Result<UserProfile, AppError> {
    let token = bearer_token(&req)?;
    let AuthenticatedUser { user_id } = state.jwt.verify(token).await?;
    tracing::info!(event = "me_called", user_id = %user_id);
    user::get_or_create_profile(state, &user_id, &user_id).await
}

/// `PATCH /v1/me`
///
/// Sets the caller's display name (upsert). The single bootstrap/edit path for
/// the display name now that Cognito holds auth only (decision 0019).
pub async fn update(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    match update_inner(state, req).await {
        Ok(profile) => json_response(
            200,
            &MeResponse::from_profile(profile, state.media.as_ref()),
        ),
        Err(err) => error_response(err),
    }
}

async fn update_inner(state: &AppState, req: Request) -> Result<UserProfile, AppError> {
    let token = bearer_token(&req)?;
    let AuthenticatedUser { user_id } = state.jwt.verify(token).await?;

    let body: UpdateProfileBody = serde_json::from_slice(req.body().as_ref())
        .map_err(|e| AppError::BadRequest(format!("invalid request body: {e}")))?;
    let name = validate_display_name(&body.display_name)?;

    let profile = user::upsert_display_name(state, &user_id, &name).await?;
    // The name itself may be PII (a real name) — log the event + user, never the value.
    tracing::info!(event = "profile_updated", user_id = %user_id);
    Ok(profile)
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
