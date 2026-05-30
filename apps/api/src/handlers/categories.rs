use lambda_http::{Body, Error, Request, Response};
use serde::{Deserialize, Serialize};

use crate::auth::{bearer_token, perms, AuthenticatedUser};
use crate::domain::category::validate_name;
use crate::error::AppError;
use crate::repo::category;
use crate::state::AppState;

#[derive(Debug, Serialize)]
struct CategoryView {
    id: String,
    name: String,
    position: i64,
}

#[derive(Debug, Serialize)]
struct CategoryListResponse {
    categories: Vec<CategoryView>,
}

#[derive(Debug, Deserialize)]
struct NameBody {
    name: String,
}

fn view(c: &category::Category) -> CategoryView {
    CategoryView {
        id: c.id.clone(),
        name: c.name.clone(),
        position: c.position,
    }
}

pub async fn list(state: &AppState, req: Request, slug: &str) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            let cats = category::list_for_project(state, &auth.project.id).await?;
            Ok(CategoryListResponse {
                categories: cats.iter().map(view).collect(),
            })
        },
        200,
    )
    .await
}

pub async fn create(state: &AppState, req: Request, slug: &str) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_admin(state, &user, slug).await?;
            let body: NameBody = parse_body(&req)?;
            let name = validate_name(&body.name)?;

            let existing = category::list_for_project(state, &auth.project.id).await?;
            if existing.iter().any(|c| c.name.eq_ignore_ascii_case(&name)) {
                return Err(AppError::Conflict(format!(
                    "a category named \"{name}\" already exists"
                )));
            }
            let cat =
                category::create(state, &auth.project.id, &name, existing.len() as i64).await?;
            tracing::info!(
                event = "category_created",
                project_id = %auth.project.id,
                category_id = %cat.id,
                by_user = %user.user_id,
            );
            Ok(view(&cat))
        },
        201,
    )
    .await
}

pub async fn update(
    state: &AppState,
    req: Request,
    slug: &str,
    category_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_admin(state, &user, slug).await?;
            let cat = category::get(state, &auth.project.id, category_id).await?;
            let body: NameBody = parse_body(&req)?;
            let name = validate_name(&body.name)?;

            let existing = category::list_for_project(state, &auth.project.id).await?;
            if existing
                .iter()
                .any(|c| c.id != cat.id && c.name.eq_ignore_ascii_case(&name))
            {
                return Err(AppError::Conflict(format!(
                    "a category named \"{name}\" already exists"
                )));
            }
            category::rename(state, &auth.project.id, &cat.id, &name).await?;
            tracing::info!(
                event = "category_renamed",
                project_id = %auth.project.id,
                category_id = %cat.id,
                by_user = %user.user_id,
            );
            Ok(CategoryView {
                id: cat.id,
                name,
                position: cat.position,
            })
        },
        200,
    )
    .await
}

pub async fn delete(
    state: &AppState,
    req: Request,
    slug: &str,
    category_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_admin(state, &user, slug).await?;
            let cat = category::get(state, &auth.project.id, category_id).await?;

            if category::count_referencing(state, &auth.project.id, &cat.id).await? > 0 {
                return Err(AppError::Conflict(
                    "category still has proposals — re-categorise them first".into(),
                ));
            }
            if category::list_for_project(state, &auth.project.id)
                .await?
                .len()
                <= 1
            {
                return Err(AppError::Conflict(
                    "a project must keep at least one category".into(),
                ));
            }
            category::delete(state, &auth.project.id, &cat.id).await?;
            tracing::info!(
                event = "category_deleted",
                project_id = %auth.project.id,
                category_id = %cat.id,
                by_user = %user.user_id,
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
