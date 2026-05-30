use lambda_http::{Body, Error, Request, Response};
use serde::Deserialize;

use crate::auth::{bearer_token, perms, AuthenticatedUser};
use crate::domain::vote::Choice;
use crate::error::AppError;
use crate::repo::{proposal, vote};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct CastVoteBody {
    choice: String,
}

pub async fn cast(
    state: &AppState,
    req: Request,
    slug: &str,
    proposal_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            let body: CastVoteBody = parse_body(&req)?;
            let choice: Choice = body.choice.parse()?;

            // Make sure the proposal lives under this project; surfaces the
            // right 404 instead of a transaction failure.
            let prop = proposal::get(state, &auth.project.id, proposal_id).await?;
            if prop.status.is_terminal() {
                return Err(AppError::Conflict("voting is closed".into()));
            }

            // A pick must be a node in this deliberation (the root or any of its
            // forks). "None of these" and "abstain" are always valid.
            if let Some(id) = choice.picked_id() {
                let picked = match proposal::get(state, &auth.project.id, id).await {
                    Ok(p) => p,
                    Err(AppError::NotFound) => {
                        return Err(AppError::BadRequest(
                            "choice is not a proposal in this project".into(),
                        ))
                    }
                    Err(e) => return Err(e),
                };
                if picked.root_id != prop.root_id {
                    return Err(AppError::BadRequest(
                        "choice must be an alternative in this deliberation".into(),
                    ));
                }
                if picked.is_question {
                    return Err(AppError::BadRequest(
                        "the question itself is not a votable option — pick one of its options"
                            .into(),
                    ));
                }
            }

            let previous = vote::get(state, &prop.root_id, &user.user_id)
                .await?
                .map(|v| v.choice);
            let had_prev = previous.is_some();

            vote::cast(
                state,
                &user,
                &auth.project.id,
                &prop.root_id,
                choice,
                previous,
            )
            .await?;

            // Note: the chosen value is deliberately NOT logged — vote choice
            // tied to a user is PII (CLAUDE.md § Hard prohibitions).
            tracing::info!(
                event = if had_prev { "vote_changed" } else { "vote_cast" },
                proposal_id = %prop.id,
                root_id = %prop.root_id,
                user_id = %user.user_id,
                had_prev = had_prev,
            );
            Ok(serde_json::json!({ "ok": true }))
        },
        200,
    )
    .await
}

pub async fn retract(
    state: &AppState,
    req: Request,
    slug: &str,
    proposal_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;

            let prop = proposal::get(state, &auth.project.id, proposal_id).await?;
            if prop.status.is_terminal() {
                return Err(AppError::Conflict("voting is closed".into()));
            }

            let previous = vote::get(state, &prop.root_id, &user.user_id)
                .await?
                .ok_or(AppError::NotFound)?;

            vote::retract(
                state,
                &user,
                &auth.project.id,
                &prop.root_id,
                previous.choice,
            )
            .await?;

            tracing::info!(
                event = "vote_retracted",
                proposal_id = %prop.id,
                user_id = %user.user_id,
            );
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

fn parse_body<T: for<'de> Deserialize<'de>>(req: &Request) -> Result<T, AppError> {
    let bytes = match req.body() {
        Body::Text(s) => s.as_bytes().to_vec(),
        Body::Binary(b) => b.clone(),
        Body::Empty => Vec::new(),
    };
    serde_json::from_slice(&bytes)
        .map_err(|e| AppError::BadRequest(format!("invalid JSON body: {e}")))
}
