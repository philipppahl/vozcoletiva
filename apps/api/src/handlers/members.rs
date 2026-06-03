use lambda_http::{Body, Error, Request, Response};
use serde::Serialize;

use crate::auth::{bearer_token, perms};
use crate::error::AppError;
use crate::repo::{membership, user};
use crate::state::AppState;

#[derive(Debug, Serialize)]
struct MemberView {
    user_id: String,
    display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    handle: Option<String>,
    role: String,
    joined_at: String,
    avatar_url: Option<String>,
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
            let ids: Vec<String> = items.iter().map(|m| m.user_id.clone()).collect();
            let refs = user::profile_refs(state, &ids).await?;
            let media = state.media.as_ref();
            Ok(ListResponse {
                members: items
                    .into_iter()
                    .map(|m| {
                        let r = refs.get(&m.user_id);
                        let avatar_url = media
                            .zip(r.and_then(|r| r.avatar_key.as_ref()))
                            .map(|(cfg, key)| cfg.url_for(key));
                        MemberView {
                            user_id: m.user_id,
                            display_name: m.display_name,
                            handle: r.and_then(|r| r.handle.clone()),
                            role: m.role.as_str().to_string(),
                            joined_at: m.joined_at.to_rfc3339(),
                            avatar_url,
                        }
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
