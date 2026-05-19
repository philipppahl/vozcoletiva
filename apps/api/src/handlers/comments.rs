use lambda_http::{Body, Error, Request, Response};
use serde::{Deserialize, Serialize};

use crate::auth::{bearer_token, perms, AuthenticatedUser};
use crate::domain::comment::Body as CommentBody;
use crate::error::AppError;
use crate::repo::{comment, proposal, user as user_repo};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct CreateCommentBody {
    body: String,
}

#[derive(Debug, Deserialize)]
struct UpdateCommentBody {
    body: String,
}

#[derive(Debug, Serialize)]
struct CommentView {
    id: String,
    proposal_id: String,
    author_id: String,
    author_display_name: String,
    body: Option<String>,
    created_at: String,
    edited_at: Option<String>,
    deleted_at: Option<String>,
    deleted_by: Option<String>,
}

impl From<comment::Comment> for CommentView {
    fn from(c: comment::Comment) -> Self {
        Self {
            id: c.id,
            proposal_id: c.proposal_id,
            author_id: c.author_id,
            author_display_name: c.author_display_name,
            body: c.body,
            created_at: c.created_at.to_rfc3339(),
            edited_at: c.edited_at.map(|d| d.to_rfc3339()),
            deleted_at: c.deleted_at.map(|d| d.to_rfc3339()),
            deleted_by: c.deleted_by,
        }
    }
}

#[derive(Debug, Serialize)]
struct CommentListResponse {
    comments: Vec<CommentView>,
}

pub async fn create(
    state: &AppState,
    req: Request,
    slug: &str,
    proposal_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            // Verify proposal exists in this project.
            proposal::get(state, &auth.project.id, proposal_id).await?;

            let raw: CreateCommentBody = parse_body(&req)?;
            let body = CommentBody::parse(raw.body)?;
            let display_name = display_name_for(state, &user).await;

            let c = comment::create(state, proposal_id, &user, &display_name, body).await?;
            tracing::info!(
                event = "comment_created",
                proposal_id = %proposal_id,
                comment_id = %c.id,
            );
            Ok(CommentView::from(c))
        },
        201,
    )
    .await
}

pub async fn list(
    state: &AppState,
    req: Request,
    slug: &str,
    proposal_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            proposal::get(state, &auth.project.id, proposal_id).await?;
            let items = comment::list_for_proposal(state, proposal_id).await?;
            Ok(CommentListResponse {
                comments: items.into_iter().map(CommentView::from).collect(),
            })
        },
        200,
    )
    .await
}

pub async fn update(
    state: &AppState,
    req: Request,
    slug: &str,
    proposal_id: &str,
    comment_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            proposal::get(state, &auth.project.id, proposal_id).await?;
            let raw: UpdateCommentBody = parse_body(&req)?;
            let body = CommentBody::parse(raw.body)?;
            let updated =
                comment::update_body(state, proposal_id, comment_id, &user, body).await?;
            tracing::info!(
                event = "comment_edited",
                proposal_id = %proposal_id,
                comment_id = %comment_id,
            );
            Ok(CommentView::from(updated))
        },
        200,
    )
    .await
}

pub async fn delete(
    state: &AppState,
    req: Request,
    slug: &str,
    proposal_id: &str,
    comment_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            proposal::get(state, &auth.project.id, proposal_id).await?;
            let is_admin = auth.role.is_admin_or_above();
            let was_author_check_only = !is_admin;
            let updated = comment::soft_delete(
                state,
                proposal_id,
                comment_id,
                &user,
                is_admin,
            )
            .await?;
            tracing::info!(
                event = "comment_deleted",
                proposal_id = %proposal_id,
                comment_id = %comment_id,
                by_user = %user.user_id,
                was_author = was_author_check_only,
            );
            Ok(CommentView::from(updated))
        },
        200,
    )
    .await
}

async fn authenticate(
    state: &AppState,
    req: &Request,
) -> Result<AuthenticatedUser, AppError> {
    let token = bearer_token(req)?;
    state.jwt.verify(token).await
}

fn parse_body<T: for<'de> Deserialize<'de>>(req: &Request) -> Result<T, AppError> {
    let bytes = match req.body() {
        Body::Text(s) => s.as_bytes().to_vec(),
        Body::Binary(b) => b.clone(),
        Body::Empty => Vec::new(),
    };
    serde_json::from_slice(&bytes)
        .map_err(|e| AppError::BadRequest(format!("invalid JSON body: {e}")))
}

async fn display_name_for(state: &AppState, user: &AuthenticatedUser) -> String {
    match user_repo::get_or_create_profile(state, &user.user_id, &user.user_id).await {
        Ok(p) => p.display_name,
        Err(_) => user.user_id.clone(),
    }
}
