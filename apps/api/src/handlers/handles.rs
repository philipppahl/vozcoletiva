//! User @handle endpoints (decision 0030): check availability of a candidate
//! handle, and set/change the caller's own handle. Handles are unique,
//! case-insensitive, mention-friendly identifiers claimed via a `HANDLE#<h>`
//! sentinel (see `repo::user::set_handle`). Validation lives in
//! `domain::handle::validate_handle`.

use lambda_http::{Body, Error, Request, Response};
use serde::{Deserialize, Serialize};

use crate::auth::{bearer_token, AuthenticatedUser};
use crate::domain::handle::validate_handle;
use crate::error::AppError;
use crate::repo::user;
use crate::state::AppState;

#[derive(Debug, Serialize)]
struct AvailabilityResponse {
    handle: String,
    available: bool,
}

/// `GET /v1/handles/{handle}/availability`
///
/// Reports whether `handle` is free to claim. **Auth-optional**: the sign-up
/// form checks availability before the account exists, so an anonymous request
/// is allowed; when a valid token *is* present, the caller's own current handle
/// reads as available (so editing the profile doesn't flag a no-op save). An
/// invalid handle is a 400 — the client validates shape locally first, but we
/// never trust that.
pub async fn availability(
    state: &AppState,
    req: Request,
    raw_handle: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            // Best-effort identity: present + valid → Some, otherwise anonymous.
            let caller = match bearer_token(&req) {
                Ok(token) => state.jwt.verify(token).await.ok().map(|u| u.user_id),
                Err(_) => None,
            };
            let handle = validate_handle(raw_handle)?;
            let owner = user::user_by_handle(state, &handle).await?;
            // Free if unclaimed, or already claimed by the caller themselves.
            let available = match owner {
                None => true,
                Some(ref uid) => Some(uid) == caller.as_ref(),
            };
            Ok(AvailabilityResponse { handle, available })
        },
        200,
    )
    .await
}

#[derive(Debug, Deserialize)]
struct SetHandleBody {
    handle: String,
}

#[derive(Debug, Serialize)]
struct SetHandleResponse {
    handle: String,
}

/// `PUT /v1/me/handle`
///
/// Claims (or changes to) the given handle for the caller. 409 if the handle is
/// already taken by someone else; 400 if the handle is malformed or reserved.
pub async fn set(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let AuthenticatedUser { user_id } = authenticate(state, &req).await?;
            let body: SetHandleBody = serde_json::from_slice(req.body().as_ref())
                .map_err(|e| AppError::BadRequest(format!("invalid request body: {e}")))?;
            let handle = validate_handle(&body.handle)?;
            user::set_handle(state, &user_id, &handle).await?;
            tracing::info!(event = "handle_set", user_id = %user_id);
            Ok(SetHandleResponse { handle })
        },
        200,
    )
    .await
}

async fn authenticate(state: &AppState, req: &Request) -> Result<AuthenticatedUser, AppError> {
    let token = bearer_token(req)?;
    state.jwt.verify(token).await
}
