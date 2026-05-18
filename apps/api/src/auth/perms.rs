use crate::auth::AuthenticatedUser;
use crate::domain::role::Role;
use crate::error::AppError;
use crate::repo::{membership, project};
use crate::state::AppState;

/// Authorisation result for a project-scoped request.
pub struct ProjectAuth {
    pub project: project::Project,
    pub role: Role,
}

/// Ensure the user is a member of `slug` (at any role). Returns the project +
/// the user's role for downstream handlers to use.
pub async fn require_member(
    state: &AppState,
    user: &AuthenticatedUser,
    slug: &str,
) -> Result<ProjectAuth, AppError> {
    let project = project::get_by_slug(state, slug).await?;
    let membership = membership::get(state, &project.id, &user.user_id).await;
    match membership {
        Ok(m) => Ok(ProjectAuth { project, role: m.role }),
        Err(AppError::NotFound) => Err(AppError::Forbidden(
            "you are not a member of this project".into(),
        )),
        Err(other) => Err(other),
    }
}

/// Ensure the user is an Owner or Admin of `slug`. Returns the project + role.
pub async fn require_admin(
    state: &AppState,
    user: &AuthenticatedUser,
    slug: &str,
) -> Result<ProjectAuth, AppError> {
    let auth = require_member(state, user, slug).await?;
    if !auth.role.is_admin_or_above() {
        return Err(AppError::Forbidden(
            "only owners and admins may perform this action".into(),
        ));
    }
    Ok(auth)
}
