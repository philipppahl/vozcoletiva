use chrono::Utc;
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
    /// Quote-reply to an existing comment in this proposal (decision 0033).
    #[serde(default)]
    reply_to_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateCommentBody {
    body: String,
}

#[derive(Debug, Deserialize)]
struct ReactionBody {
    emoji: String,
    active: bool,
}

/// Snapshot of the quoted comment, surfaced on a reply (decision 0033).
#[derive(Debug, Serialize)]
struct ReplyToView {
    id: String,
    author_display_name: String,
    preview: String,
}

/// A reaction tally on a comment: the emoji, how many reacted, and whether the
/// viewer is one of them.
#[derive(Debug, Serialize)]
struct ReactionView {
    emoji: String,
    count: i64,
    me: bool,
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
    reply_to: Option<ReplyToView>,
    reactions: Vec<ReactionView>,
}

/// Reaction tallies for a comment, filtered to positive counts, with the
/// viewer's own reactions flagged (`me` set holds `"<commentId>#<emoji>"`).
fn reaction_views(
    c: &comment::Comment,
    me: &std::collections::HashSet<String>,
) -> Vec<ReactionView> {
    crate::domain::reaction::REACTIONS
        .iter()
        .filter_map(|emoji| {
            let count = c.reaction_counts.get(*emoji).copied().unwrap_or(0);
            (count > 0).then(|| ReactionView {
                emoji: (*emoji).to_string(),
                count,
                me: me.contains(&format!("{}#{}", c.id, emoji)),
            })
        })
        .collect()
}

fn comment_view(c: comment::Comment, me: &std::collections::HashSet<String>) -> CommentView {
    let reactions = reaction_views(&c, me);
    let reply_to = c.reply_to.as_ref().map(|rt| ReplyToView {
        id: rt.id.clone(),
        author_display_name: rt.author_display_name.clone(),
        preview: rt.preview.clone(),
    });
    CommentView {
        id: c.id,
        proposal_id: c.proposal_id,
        author_id: c.author_id,
        author_display_name: c.author_display_name,
        body: c.body,
        created_at: c.created_at.to_rfc3339(),
        edited_at: c.edited_at.map(|d| d.to_rfc3339()),
        deleted_at: c.deleted_at.map(|d| d.to_rfc3339()),
        deleted_by: c.deleted_by,
        reply_to,
        reactions,
    }
}

#[derive(Debug, Serialize)]
struct CommentListResponse {
    comments: Vec<CommentView>,
}

#[derive(Debug, Serialize)]
struct ReactionResponse {
    reactions: Vec<ReactionView>,
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
            let proposal = proposal::get(state, &auth.project.id, proposal_id).await?;

            let raw: CreateCommentBody = parse_body(&req)?;
            let body = CommentBody::parse(raw.body)?;
            let display_name = display_name_for(state, &user).await;

            // Resolve the quote-reply snapshot, if any (decision 0033).
            let reply_to = match &raw.reply_to_id {
                Some(rid) => {
                    let parent = comment::get(state, proposal_id, rid).await?;
                    Some(comment::CommentReplyTo {
                        id: parent.id.clone(),
                        author_id: parent.author_id.clone(),
                        author_display_name: parent.author_display_name.clone(),
                        preview: comment::preview_of(&parent),
                    })
                }
                None => None,
            };

            let c = comment::create(state, proposal_id, &user, &display_name, body, reply_to)
                .await?;
            tracing::info!(
                event = "comment_created",
                proposal_id = %proposal_id,
                comment_id = %c.id,
                is_reply = c.reply_to.is_some(),
            );
            // Best-effort notifications — never fail the comment.
            if let Err(e) =
                crate::notify::proposal_comment(state, &proposal, &c, &Utc::now().to_rfc3339()).await
            {
                tracing::warn!(event = "inbox_fanout_failed", trigger = "comment", error = %e);
            }
            Ok(comment_view(c, &std::collections::HashSet::new()))
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
            let me = comment::user_reactions(state, proposal_id, &user.user_id).await?;
            Ok(CommentListResponse {
                comments: items.into_iter().map(|c| comment_view(c, &me)).collect(),
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
            let me = comment::user_reactions(state, proposal_id, &user.user_id).await?;
            Ok(comment_view(updated, &me))
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
            Ok(comment_view(updated, &std::collections::HashSet::new()))
        },
        200,
    )
    .await
}

/// Toggle the caller's reaction on a comment (decision 0033). Mirrors the
/// message reaction endpoint: validate the emoji, write, then re-read
/// **consistently** for authoritative counts + the viewer's set.
pub async fn set_reaction(
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
            let body: ReactionBody = parse_body(&req)?;
            if !crate::domain::reaction::is_allowed(&body.emoji) {
                return Err(AppError::BadRequest("unsupported reaction".into()));
            }
            comment::set_reaction(
                state,
                proposal_id,
                comment_id,
                &user.user_id,
                &body.emoji,
                body.active,
            )
            .await?;
            tracing::info!(
                event = "comment_reaction_set",
                proposal_id = %proposal_id,
                comment_id = %comment_id,
                active = body.active,
                by_user = %user.user_id,
            );
            let fresh = comment::get(state, proposal_id, comment_id).await?;
            let me = comment::user_reactions(state, proposal_id, &user.user_id).await?;
            Ok(ReactionResponse {
                reactions: reaction_views(&fresh, &me),
            })
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
