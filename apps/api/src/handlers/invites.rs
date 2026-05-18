use chrono::Duration;
use lambda_http::{Body, Error, Request, Response};
use serde::{Deserialize, Serialize};

use crate::auth::{bearer_token, perms, AuthenticatedUser};
use crate::domain::{code, role::Role};
use crate::error::AppError;
use crate::repo::{invite, membership, project, user as user_repo};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct IssueInviteBody {
    role: String,
    #[serde(default)]
    expires_in_days: Option<i64>,
    #[serde(default)]
    max_uses: Option<i64>,
    #[serde(default)]
    note: Option<String>,
}

#[derive(Debug, Serialize)]
struct InviteView {
    id: String,
    project_id: String,
    token: String,
    code: String,
    role: String,
    max_uses: Option<i64>,
    use_count: i64,
    expires_at: Option<String>,
    note: Option<String>,
    issued_by: String,
    issued_at: String,
    revoked_at: Option<String>,
}
impl From<invite::Invite> for InviteView {
    fn from(i: invite::Invite) -> Self {
        Self {
            id: i.id,
            project_id: i.project_id,
            token: i.token,
            code: i.code,
            role: i.role.as_str().to_string(),
            max_uses: i.max_uses,
            use_count: i.use_count,
            expires_at: i.expires_at.map(|d| d.to_rfc3339()),
            note: i.note,
            issued_by: i.issued_by,
            issued_at: i.issued_at.to_rfc3339(),
            revoked_at: i.revoked_at.map(|d| d.to_rfc3339()),
        }
    }
}

#[derive(Debug, Serialize)]
struct InviteListResponse {
    invites: Vec<InviteView>,
}

#[derive(Debug, Serialize)]
struct InvitePreview {
    project_name: String,
    project_slug: String,
    role: String,
    expires_at: Option<String>,
    use_count: i64,
    max_uses: Option<i64>,
    revoked: bool,
    valid: bool,
}

#[derive(Debug, Serialize)]
struct AcceptResponse {
    project: ProjectViewSimple,
    role: String,
}

#[derive(Debug, Serialize)]
struct ProjectViewSimple {
    id: String,
    slug: String,
    name: String,
}

pub async fn issue(
    state: &AppState,
    req: Request,
    slug: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_admin(state, &user, slug).await?;

            let body_bytes = req_body_bytes(&req);
            let body: IssueInviteBody = serde_json::from_slice(&body_bytes)
                .map_err(|e| AppError::BadRequest(format!("invalid JSON body: {e}")))?;
            let role: Role = body.role.parse()?;
            let expires_in = body.expires_in_days.map(Duration::days);

            let inv = invite::create(
                state,
                &user,
                &auth.project.id,
                role,
                expires_in,
                body.max_uses,
                body.note,
            )
            .await?;
            tracing::info!(
                event = "invite_issued",
                project_id = %auth.project.id,
                invite_id = %inv.id,
                role = %role,
            );
            Ok(InviteView::from(inv))
        },
        201,
    )
    .await
}

pub async fn list(
    state: &AppState,
    req: Request,
    slug: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_admin(state, &user, slug).await?;
            let items = invite::list_for_project(state, &auth.project.id).await?;
            Ok(InviteListResponse {
                invites: items.into_iter().map(InviteView::from).collect(),
            })
        },
        200,
    )
    .await
}

pub async fn revoke(
    state: &AppState,
    req: Request,
    slug: &str,
    invite_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_admin(state, &user, slug).await?;
            invite::revoke(state, &auth.project.id, invite_id).await?;
            tracing::info!(
                event = "invite_revoked",
                project_id = %auth.project.id,
                invite_id = %invite_id,
                by_user = %user.user_id,
            );
            Ok(serde_json::json!({ "ok": true }))
        },
        200,
    )
    .await
}

pub async fn preview_by_token(
    state: &AppState,
    req: Request,
    token: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let _user = authenticate(state, &req).await?;
            let inv = invite::get_by_token(state, token).await?;
            preview_from(state, inv).await
        },
        200,
    )
    .await
}

pub async fn preview_by_code(
    state: &AppState,
    req: Request,
    raw_code: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let _user = authenticate(state, &req).await?;
            let normalised = code::parse(raw_code)?;
            let inv = invite::get_by_code(state, &normalised).await?;
            preview_from(state, inv).await
        },
        200,
    )
    .await
}

pub async fn accept(
    state: &AppState,
    req: Request,
    token: &str,
) -> Result<Response<Body>, Error> {
    accept_inner(state, req, AcceptKey::Token(token.to_string())).await
}

pub async fn accept_by_code(
    state: &AppState,
    req: Request,
    raw_code: &str,
) -> Result<Response<Body>, Error> {
    let key = match code::parse(raw_code) {
        Ok(c) => AcceptKey::Code(c),
        Err(e) => {
            return super::json_or_error::<serde_json::Value, _>(
                async { Err::<serde_json::Value, AppError>(e) },
                200,
            )
            .await
        }
    };
    accept_inner(state, req, key).await
}

enum AcceptKey {
    Token(String),
    Code(String),
}

async fn accept_inner(
    state: &AppState,
    req: Request,
    key: AcceptKey,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let inv = match &key {
                AcceptKey::Token(t) => invite::get_by_token(state, t).await?,
                AcceptKey::Code(c) => invite::get_by_code(state, c).await?,
            };

            // Already a member? Treat accept as idempotent.
            if let Ok(existing) = membership::get(state, &inv.project_id, &user.user_id).await {
                let p = project::get_by_slug_from_id(state, &inv.project_id).await?;
                return Ok(AcceptResponse {
                    project: ProjectViewSimple {
                        id: p.id,
                        slug: p.slug,
                        name: p.name,
                    },
                    role: existing.role.as_str().to_string(),
                });
            }

            // Atomically consume one use of the invite.
            let _consumed = invite::consume(state, &inv).await?;

            let display_name = display_name_for(state, &user).await;
            let m = membership::add(
                state,
                &inv.project_id,
                &user.user_id,
                &display_name,
                inv.role,
            )
            .await?;

            tracing::info!(
                event = "invite_used",
                project_id = %inv.project_id,
                invite_id = %inv.id,
                user_id = %user.user_id,
            );

            let p = project::get_by_slug_from_id(state, &inv.project_id).await?;
            Ok(AcceptResponse {
                project: ProjectViewSimple {
                    id: p.id,
                    slug: p.slug,
                    name: p.name,
                },
                role: m.role.as_str().to_string(),
            })
        },
        200,
    )
    .await
}

async fn preview_from(state: &AppState, inv: invite::Invite) -> Result<InvitePreview, AppError> {
    let p = project::get_by_slug_from_id(state, &inv.project_id).await?;
    let now = chrono::Utc::now();
    let expired = inv.expires_at.is_some_and(|t| t <= now);
    let used_up = inv
        .max_uses
        .is_some_and(|max| inv.use_count >= max);
    let revoked = inv.revoked_at.is_some();
    let valid = !revoked && !expired && !used_up;

    Ok(InvitePreview {
        project_name: p.name,
        project_slug: p.slug,
        role: inv.role.as_str().to_string(),
        expires_at: inv.expires_at.map(|d| d.to_rfc3339()),
        use_count: inv.use_count,
        max_uses: inv.max_uses,
        revoked,
        valid,
    })
}

async fn authenticate(
    state: &AppState,
    req: &Request,
) -> Result<AuthenticatedUser, AppError> {
    let token = bearer_token(req)?;
    state.jwt.verify(token).await
}

fn req_body_bytes(req: &Request) -> Vec<u8> {
    match req.body() {
        Body::Text(s) => s.as_bytes().to_vec(),
        Body::Binary(b) => b.clone(),
        Body::Empty => Vec::new(),
    }
}

async fn display_name_for(state: &AppState, user: &AuthenticatedUser) -> String {
    match user_repo::get_or_create_profile(state, &user.user_id, &user.user_id).await {
        Ok(p) => p.display_name,
        Err(_) => user.user_id.clone(),
    }
}
