use lambda_http::{Body, Error, Request, Response};
use serde::{Deserialize, Serialize};

use crate::auth::{bearer_token, perms, AuthenticatedUser};
use crate::domain::slug::Slug;
use crate::error::AppError;
use crate::repo::{project, user as user_repo};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct CreateProjectBody {
    name: String,
    slug: String,
    #[serde(default = "default_template")]
    template: String,
}
fn default_template() -> String {
    "custom".to_string()
}

#[derive(Debug, Serialize)]
struct ProjectView {
    id: String,
    slug: String,
    name: String,
    template: String,
    visibility: String,
    owner_id: String,
    created_at: String,
}
impl From<project::Project> for ProjectView {
    fn from(p: project::Project) -> Self {
        Self {
            id: p.id,
            slug: p.slug,
            name: p.name,
            template: p.template,
            visibility: p.visibility,
            owner_id: p.owner_id,
            created_at: p.created_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Serialize)]
struct ProjectListEntry {
    project: ProjectView,
    role: String,
}

#[derive(Debug, Serialize)]
struct ProjectListResponse {
    projects: Vec<ProjectListEntry>,
}

#[derive(Debug, Serialize)]
struct ProjectDetailResponse {
    project: ProjectView,
    role: String,
}

pub async fn create(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let body_bytes = req_body_bytes(&req);
            let body: CreateProjectBody = serde_json::from_slice(&body_bytes)
                .map_err(|e| AppError::BadRequest(format!("invalid JSON body: {e}")))?;
            if body.name.trim().is_empty() || body.name.len() > 80 {
                return Err(AppError::BadRequest(
                    "name must be 1-80 characters".into(),
                ));
            }
            let slug = Slug::parse(body.slug)?;
            let display_name = display_name_for(state, &user).await;
            let project = project::create(
                state,
                &user,
                &display_name,
                body.name,
                slug,
                body.template,
            )
            .await?;
            tracing::info!(event = "project_created", project_id = %project.id);
            Ok(ProjectView::from(project))
        },
        201,
    )
    .await
}

pub async fn list_mine(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let items = project::list_for_user(state, &user.user_id).await?;
            Ok(ProjectListResponse {
                projects: items
                    .into_iter()
                    .map(|i| ProjectListEntry {
                        project: ProjectView::from(i.project),
                        role: i.role.as_str().to_string(),
                    })
                    .collect(),
            })
        },
        200,
    )
    .await
}

pub async fn get(
    state: &AppState,
    req: Request,
    slug: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            Ok(ProjectDetailResponse {
                project: ProjectView::from(auth.project),
                role: auth.role.as_str().to_string(),
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
