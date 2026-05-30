use ammonia::clean;
use chrono::{DateTime, Utc};
use lambda_http::{Body, Error, Request, Response};
use serde::{Deserialize, Serialize};

use std::collections::HashMap;

use crate::auth::{bearer_token, perms, AuthenticatedUser};
use crate::domain::proposal::{ProposalStatus, Tally};
use crate::domain::voting_rule::VotingRule;
use crate::error::AppError;
use crate::repo::{proposal, vote};
use crate::scheduler::{cancel_close, schedule_close};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct CreateProposalBody {
    title: String,
    body: String,
    /// Required for a root; ignored (inherited from the root) for a fork.
    #[serde(default)]
    voting_rule: String,
    quorum: Option<i64>,
    /// Required for a root; ignored for a fork.
    #[serde(default)]
    ends_at: String,
    /// When set, creates a fork under this parent's deliberation.
    parent_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct ProposalView {
    id: String,
    project_id: String,
    root_id: String,
    parent_id: Option<String>,
    author_id: String,
    title: String,
    body: String,
    voting_rule: String,
    quorum: Option<i64>,
    ends_at: String,
    status: String,
    /// proposalId → votes. For a plain decision the only key is the root id.
    tally_by_choice: HashMap<String, i64>,
    tally_none: i64,
    tally_abstain: i64,
    /// Picks + "none of these". Abstain excluded.
    tally_decisive: i64,
    /// Everyone who voted, including abstainers.
    tally_total: i64,
    created_at: String,
    closed_at: Option<String>,
    /// The caller's choice: a proposalId, `__none__`, `__abstain__`, or null.
    your_choice: Option<String>,
}

#[derive(Debug, Serialize)]
struct ProposalListResponse {
    proposals: Vec<ProposalView>,
}

pub async fn create(state: &AppState, req: Request, slug: &str) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            let body: CreateProposalBody = parse_body(&req)?;

            let title = body.title.trim().to_string();
            if title.is_empty() || title.len() > 200 {
                return Err(AppError::BadRequest("title must be 1-200 chars".into()));
            }
            // Sanitise markdown body once on submit. The FE also sanitises on
            // render (defence in depth) — see docs/conventions/validation.md.
            let body_md = clean(&body.body);
            if body_md.is_empty() || body_md.len() > 50_000 {
                return Err(AppError::BadRequest("body must be 1-50_000 chars".into()));
            }
            // A fork inherits the root's rule / quorum / ends_at and joins its
            // tree; a root needs its own config + close schedule. The response
            // carries the deliberation (root) tally either way.
            let (prop, root_tally) = if let Some(parent_id) = body.parent_id.as_deref() {
                let parent = proposal::get(state, &auth.project.id, parent_id).await?;
                let root = if parent.id == parent.root_id {
                    parent
                } else {
                    proposal::get(state, &auth.project.id, &parent.root_id).await?
                };
                if root.status.is_terminal() {
                    return Err(AppError::Conflict(
                        "cannot fork a closed deliberation".into(),
                    ));
                }
                let fork = proposal::create_fork(
                    state,
                    &auth.project.id,
                    &user,
                    title,
                    body_md,
                    parent_id,
                    &root,
                )
                .await?;
                tracing::info!(
                    event = "proposal_forked",
                    project_id = %auth.project.id,
                    proposal_id = %fork.id,
                    root_id = %root.id,
                    parent_id = %parent_id,
                    by_user = %user.user_id,
                );
                let tally = root.tally.clone();
                (fork, tally)
            } else {
                let voting_rule: VotingRule = body.voting_rule.parse()?;
                if let Some(q) = body.quorum {
                    if !(1..=100_000).contains(&q) {
                        return Err(AppError::BadRequest("quorum must be 1..=100_000".into()));
                    }
                }
                let ends_at: DateTime<Utc> = DateTime::parse_from_rfc3339(&body.ends_at)
                    .map_err(|e| AppError::BadRequest(format!("ends_at not RFC-3339: {e}")))?
                    .with_timezone(&Utc);
                if ends_at <= Utc::now() + chrono::Duration::seconds(30) {
                    return Err(AppError::BadRequest(
                        "ends_at must be at least 30 seconds in the future".into(),
                    ));
                }

                let prop = proposal::create(
                    state,
                    &auth.project.id,
                    &user,
                    title,
                    body_md,
                    voting_rule,
                    body.quorum,
                    ends_at,
                )
                .await?;

                // Schedule the close (roots only — forks ride the root's
                // schedule). If Scheduler isn't configured (local dev/worker),
                // warn but don't fail.
                if let Some(cfg) = state.scheduler.as_ref() {
                    match schedule_close(cfg, &auth.project.id, &prop.id, ends_at).await {
                        Ok(arn) => {
                            let _ = proposal::set_schedule_arn(
                                state,
                                &auth.project.id,
                                &prop.id,
                                &arn,
                            )
                            .await;
                        }
                        Err(e) => {
                            tracing::warn!(error = %e, "schedule_close failed; proposal created without auto-close");
                        }
                    }
                } else {
                    tracing::warn!(
                        "Scheduler not configured — proposal {} will not auto-close",
                        prop.id
                    );
                }

                tracing::info!(
                    event = "proposal_created",
                    project_id = %auth.project.id,
                    proposal_id = %prop.id,
                    voting_rule = %prop.voting_rule.as_str(),
                    ends_at = %prop.ends_at.to_rfc3339(),
                );
                let tally = prop.tally.clone();
                (prop, tally)
            };

            Ok(view_with_tally(&prop, None, &root_tally))
        },
        201,
    )
    .await
}

pub async fn list(state: &AppState, req: Request, slug: &str) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            let items = proposal::list_for_project(state, &auth.project.id).await?;
            let mut views = Vec::with_capacity(items.len());
            for p in items {
                let your = vote::get(state, &p.root_id, &user.user_id).await?;
                views.push(view_from(
                    &p,
                    your.as_ref().map(|v| v.choice.wire().to_string()),
                ));
            }
            Ok(ProposalListResponse { proposals: views })
        },
        200,
    )
    .await
}

pub async fn get(
    state: &AppState,
    req: Request,
    slug: &str,
    proposal_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            let p = proposal::get(state, &auth.project.id, proposal_id).await?;
            let your = vote::get(state, &p.root_id, &user.user_id)
                .await?
                .map(|v| v.choice.wire().to_string());
            // A fork carries no tally of its own — show the deliberation's.
            let root_tally = if p.id == p.root_id {
                p.tally.clone()
            } else {
                proposal::get(state, &auth.project.id, &p.root_id)
                    .await
                    .map(|r| r.tally)
                    .unwrap_or_default()
            };
            Ok(view_with_tally(&p, your, &root_tally))
        },
        200,
    )
    .await
}

/// The flat deliberation tree (root + forks). Every node's DTO carries the
/// deliberation (root) tally and the caller's single per-deliberation vote.
pub async fn tree(
    state: &AppState,
    req: Request,
    slug: &str,
    proposal_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            let p = proposal::get(state, &auth.project.id, proposal_id).await?;
            let mut nodes = proposal::tree(state, &p.root_id).await?;
            if nodes.is_empty() {
                nodes.push(p.clone());
            }
            let root_tally = nodes
                .iter()
                .find(|n| n.id == p.root_id)
                .map(|n| n.tally.clone())
                .unwrap_or_default();
            let your = vote::get(state, &p.root_id, &user.user_id)
                .await?
                .map(|v| v.choice.wire().to_string());
            let proposals = nodes
                .iter()
                .map(|n| view_with_tally(n, your.clone(), &root_tally))
                .collect();
            Ok(ProposalListResponse { proposals })
        },
        200,
    )
    .await
}

pub async fn withdraw(
    state: &AppState,
    req: Request,
    slug: &str,
    proposal_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            let p = proposal::get(state, &auth.project.id, proposal_id).await?;
            if p.author_id != user.user_id {
                return Err(AppError::Forbidden(
                    "only the proposal's author can withdraw it".into(),
                ));
            }
            if p.status.is_terminal() {
                return Err(AppError::Conflict("proposal is already closed".into()));
            }
            let _ = proposal::transition_to_terminal(
                state,
                &auth.project.id,
                &p.id,
                ProposalStatus::Withdrawn,
            )
            .await?;
            if let Some(cfg) = state.scheduler.as_ref() {
                let _ = cancel_close(cfg, &p.id).await;
            }
            tracing::info!(
                event = "proposal_withdrawn",
                proposal_id = %proposal_id,
                by_user = %user.user_id,
            );
            let refreshed = proposal::get(state, &auth.project.id, proposal_id).await?;
            Ok(view_from(&refreshed, None))
        },
        200,
    )
    .await
}

fn view_from(p: &proposal::Proposal, your_choice: Option<String>) -> ProposalView {
    let tally = p.tally.clone();
    view_with_tally(p, your_choice, &tally)
}

/// Build a DTO using an explicit tally (the deliberation/root tally), since
/// forks carry no tally of their own.
fn view_with_tally(
    p: &proposal::Proposal,
    your_choice: Option<String>,
    tally: &Tally,
) -> ProposalView {
    ProposalView {
        id: p.id.clone(),
        project_id: p.project_id.clone(),
        root_id: p.root_id.clone(),
        parent_id: p.parent_id.clone(),
        author_id: p.author_id.clone(),
        title: p.title.clone(),
        body: p.body.clone(),
        voting_rule: p.voting_rule.as_str().to_string(),
        quorum: p.quorum,
        ends_at: p.ends_at.to_rfc3339(),
        status: p.status.as_str().to_string(),
        tally_by_choice: tally.by_choice.clone(),
        tally_none: tally.none,
        tally_abstain: tally.abstain,
        tally_decisive: tally.decisive(),
        tally_total: tally.total(),
        created_at: p.created_at.to_rfc3339(),
        closed_at: p.closed_at.map(|d| d.to_rfc3339()),
        your_choice,
    }
}

async fn authenticate(state: &AppState, req: &Request) -> Result<AuthenticatedUser, AppError> {
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
