use lambda_http::{Body, Error, Request, Response};
use serde::Serialize;

use crate::auth::{bearer_token, perms};
use crate::error::AppError;
use crate::repo::membership;
use crate::state::AppState;

#[derive(Debug, Serialize)]
struct MemberView {
    user_id: String,
    display_name: String,
    role: String,
    joined_at: String,
}

#[derive(Debug, Serialize)]
struct ListResponse {
    members: Vec<MemberView>,
}

pub async fn list(state: &AppState, req: Request, slug: &str) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let token = bearer_token(&req)?;
            let user = state.jwt.verify(token).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            let items = membership::list(state, &auth.project.id).await?;
            Ok(ListResponse {
                members: items
                    .into_iter()
                    .map(|m| MemberView {
                        user_id: m.user_id,
                        display_name: m.display_name,
                        role: m.role.as_str().to_string(),
                        joined_at: m.joined_at.to_rfc3339(),
                    })
                    .collect(),
            })
        },
        200,
    )
    .await
}

#[allow(dead_code)]
fn _silence(_e: AppError) {}
