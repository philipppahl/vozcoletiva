use ammonia::clean;
use chrono::{DateTime, Utc};
use lambda_http::{Body, Error, Request, Response};
use serde::{Deserialize, Serialize};

use crate::auth::{bearer_token, perms, AuthenticatedUser};
use crate::domain::proposal::ProposalStatus;
use crate::domain::voting_mode::VotingMode;
use crate::error::AppError;
use crate::repo::{proposal, vote};
use crate::scheduler::{cancel_close, schedule_close};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct CreateProposalBody {
    title: String,
    body: String,
    voting_mode: String,
    quorum: Option<i64>,
    ends_at: String,
}

#[derive(Debug, Serialize)]
struct ProposalView {
    id: String,
    project_id: String,
    author_id: String,
    title: String,
    body: String,
    voting_mode: String,
    quorum: Option<i64>,
    ends_at: String,
    status: String,
    tally_yes: i64,
    tally_no: i64,
    tally_abstain: i64,
    voter_count: i64,
    created_at: String,
    closed_at: Option<String>,
    your_choice: Option<String>,
}

#[derive(Debug, Serialize)]
struct ProposalListResponse {
    proposals: Vec<ProposalView>,
}

pub async fn create(
    state: &AppState,
    req: Request,
    slug: &str,
) -> Result<Response<Body>, Error> {
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
            let voting_mode: VotingMode = body.voting_mode.parse()?;
            if let Some(q) = body.quorum {
                if !(1..=100_000).contains(&q) {
                    return Err(AppError::BadRequest(
                        "quorum must be 1..=100_000".into(),
                    ));
                }
            }
            let ends_at: DateTime<Utc> = DateTime::parse_from_rfc3339(&body.ends_at)
                .map_err(|e| AppError::BadRequest(format!("ends_at not RFC-3339: {e}")))?
                .with_timezone(&Utc);
            let now = Utc::now();
            if ends_at <= now + chrono::Duration::seconds(30) {
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
                voting_mode,
                body.quorum,
                ends_at,
            )
            .await?;

            // Schedule the close. If Scheduler isn't configured (local dev,
            // worker only), warn but don't fail — the worker can be invoked
            // manually if needed.
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
                voting_mode = %voting_mode.as_str(),
                ends_at = %ends_at.to_rfc3339(),
            );

            Ok(view_from(&prop, None))
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
            let auth = perms::require_member(state, &user, slug).await?;
            let items = proposal::list_for_project(state, &auth.project.id).await?;
            let mut views = Vec::with_capacity(items.len());
            for p in items {
                let your = vote::get(state, &p.id, &user.user_id).await?;
                views.push(view_from(&p, your.as_ref().map(|v| v.choice.as_str().to_string())));
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
            let your = vote::get(state, &p.id, &user.user_id).await?;
            Ok(view_from(&p, your.as_ref().map(|v| v.choice.as_str().to_string())))
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
    ProposalView {
        id: p.id.clone(),
        project_id: p.project_id.clone(),
        author_id: p.author_id.clone(),
        title: p.title.clone(),
        body: p.body.clone(),
        voting_mode: p.voting_mode.as_str().to_string(),
        quorum: p.quorum,
        ends_at: p.ends_at.to_rfc3339(),
        status: p.status.as_str().to_string(),
        tally_yes: p.tally.yes,
        tally_no: p.tally.no,
        tally_abstain: p.tally.abstain,
        voter_count: p.tally.voter_count(),
        created_at: p.created_at.to_rfc3339(),
        closed_at: p.closed_at.map(|d| d.to_rfc3339()),
        your_choice,
    }
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
