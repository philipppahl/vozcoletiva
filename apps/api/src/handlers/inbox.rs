use chrono::Utc;
use lambda_http::{Body, Error, Request, Response};
use serde::Serialize;

use crate::auth::{bearer_token, AuthenticatedUser};
use crate::error::AppError;
use crate::repo::inbox::{self, InboxItem};
use crate::state::AppState;

const PAGE_LIMIT: usize = 50;

#[derive(Debug, Serialize)]
struct InboxListResponse {
    items: Vec<InboxItem>,
    unread_count: i64,
}

/// `GET /v1/me/inbox` — the caller's notifications, newest-first, + unread count.
pub async fn list(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let before = query_param(&req, "before");
            let items = inbox::list(state, &user.user_id, before.as_deref(), PAGE_LIMIT).await?;
            let unread_count = inbox::unread_count(state, &user.user_id).await?;
            Ok(InboxListResponse {
                items,
                unread_count,
            })
        },
        200,
    )
    .await
}

/// `POST /v1/me/inbox/:id/read` — mark one item read.
pub async fn mark_read(state: &AppState, req: Request, id: &str) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let ok = inbox::mark_read(state, &user.user_id, id, &Utc::now().to_rfc3339()).await?;
            if !ok {
                return Err(AppError::NotFound);
            }
            Ok(serde_json::json!({ "ok": true }))
        },
        200,
    )
    .await
}

/// `POST /v1/me/inbox/read-all` — mark every unread item read.
pub async fn mark_all_read(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            inbox::mark_all_read(state, &user.user_id, &Utc::now().to_rfc3339()).await?;
            Ok(serde_json::json!({ "ok": true }))
        },
        200,
    )
    .await
}

async fn authenticate(state: &AppState, req: &Request) -> Result<AuthenticatedUser, AppError> {
    let token = bearer_token(req)?;
    state.jwt.verify(token).await
}

fn query_param(req: &Request, key: &str) -> Option<String> {
    let query = req.uri().query()?;
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            if k == key {
                return Some(v.to_string());
            }
        }
    }
    None
}
