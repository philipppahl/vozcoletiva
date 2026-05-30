use std::collections::HashMap;

use aws_sdk_dynamodb::types::{AttributeValue, Put, TransactWriteItem};
use chrono::{DateTime, Utc};
use serde::Serialize;
use ulid::Ulid;

use crate::auth::AuthenticatedUser;
use crate::domain::role::Role;
use crate::domain::slug::Slug;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct Project {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub template: String,
    pub visibility: String,
    pub owner_id: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug)]
pub struct ProjectListItem {
    pub project: Project,
    pub role: Role,
}

/// Create a project + the slug-claim sentinel + the Owner membership, all in
/// one transaction. Slug collisions surface as `Conflict`.
pub async fn create(
    state: &AppState,
    creator: &AuthenticatedUser,
    creator_display_name: &str,
    name: String,
    slug: Slug,
    template: String,
) -> Result<Project, AppError> {
    let project_id = Ulid::new().to_string();
    let now = Utc::now();
    let project = Project {
        id: project_id.clone(),
        slug: slug.as_str().to_string(),
        name,
        template,
        visibility: "private".to_string(),
        owner_id: creator.user_id.clone(),
        created_at: now,
    };

    let project_pk = format!("PROJECT#{project_id}");
    let slug_pk = format!("SLUG#{}", slug.as_str());
    let user_pk = format!("USER#{}", creator.user_id);

    let put_project = Put::builder()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(project_pk.clone()))
        .item("SK", AttributeValue::S("METADATA".into()))
        .item("type", AttributeValue::S("Project".into()))
        .item("projectId", AttributeValue::S(project.id.clone()))
        .item("slug", AttributeValue::S(project.slug.clone()))
        .item("name", AttributeValue::S(project.name.clone()))
        .item("template", AttributeValue::S(project.template.clone()))
        .item("visibility", AttributeValue::S(project.visibility.clone()))
        .item("ownerId", AttributeValue::S(project.owner_id.clone()))
        .item("createdAt", AttributeValue::S(now.to_rfc3339()))
        .item(
            "GSI1PK",
            AttributeValue::S(format!("PROJECTSLUG#{}", project.slug)),
        )
        .item("GSI1SK", AttributeValue::S("METADATA".into()))
        .condition_expression("attribute_not_exists(PK)")
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    let put_slug = Put::builder()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(slug_pk))
        .item("SK", AttributeValue::S("CLAIMED".into()))
        .item("type", AttributeValue::S("SlugClaim".into()))
        .item("projectId", AttributeValue::S(project.id.clone()))
        .item("claimedAt", AttributeValue::S(now.to_rfc3339()))
        .condition_expression("attribute_not_exists(PK)")
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    let put_member = Put::builder()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(project_pk))
        .item(
            "SK",
            AttributeValue::S(format!("MEMBER#{}", creator.user_id)),
        )
        .item("type", AttributeValue::S("Membership".into()))
        .item("projectId", AttributeValue::S(project.id.clone()))
        .item("userId", AttributeValue::S(creator.user_id.clone()))
        .item("role", AttributeValue::S(Role::Owner.as_str().into()))
        .item(
            "displayName",
            AttributeValue::S(creator_display_name.into()),
        )
        .item("joinedAt", AttributeValue::S(now.to_rfc3339()))
        .item("GSI1PK", AttributeValue::S(user_pk))
        .item(
            "GSI1SK",
            AttributeValue::S(format!("MEMBER#{}", project.id)),
        )
        .condition_expression("attribute_not_exists(PK)")
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    // Every project starts with one default "Commons" category, so the proposal
    // create flow always has a category to fall back to.
    let default_category = crate::repo::category::new_category(&project_id, "Commons", 0);
    let put_category = Put::builder()
        .table_name(&state.table_name)
        .set_item(Some(crate::repo::category::item_map(&default_category)))
        .condition_expression("attribute_not_exists(SK)")
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    let result = state
        .ddb
        .transact_write_items()
        .transact_items(TransactWriteItem::builder().put(put_project).build())
        .transact_items(TransactWriteItem::builder().put(put_slug).build())
        .transact_items(TransactWriteItem::builder().put(put_member).build())
        .transact_items(TransactWriteItem::builder().put(put_category).build())
        .send()
        .await;

    match result {
        Ok(_) => Ok(project),
        Err(err) => {
            let svc = err.into_service_error();
            let msg = svc.to_string();
            if msg.contains("ConditionalCheckFailed") {
                Err(AppError::Conflict("slug is already taken".into()))
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

pub async fn get_by_slug(state: &AppState, slug: &str) -> Result<Project, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .index_name("GSI1")
        .key_condition_expression("GSI1PK = :pk AND GSI1SK = :sk")
        .expression_attribute_values(":pk", AttributeValue::S(format!("PROJECTSLUG#{slug}")))
        .expression_attribute_values(":sk", AttributeValue::S("METADATA".into()))
        .limit(1)
        .send()
        .await?;

    let item = q
        .items
        .and_then(|mut v| v.pop())
        .ok_or(AppError::NotFound)?;

    project_from_item(&item)
}

pub async fn list_for_user(
    state: &AppState,
    user_id: &str,
) -> Result<Vec<ProjectListItem>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .index_name("GSI1")
        .key_condition_expression("GSI1PK = :pk AND begins_with(GSI1SK, :sk)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{user_id}")))
        .expression_attribute_values(":sk", AttributeValue::S("MEMBER#".into()))
        .send()
        .await?;

    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        let project_id = item
            .get("projectId")
            .and_then(|v| v.as_s().ok())
            .cloned()
            .ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(
                    "membership missing projectId",
                )))
            })?;
        let role_str = item
            .get("role")
            .and_then(|v| v.as_s().ok())
            .cloned()
            .unwrap_or_else(|| "member".into());
        let role: Role = role_str.parse()?;
        let project = get_by_id(state, &project_id).await?;
        out.push(ProjectListItem { project, role });
    }
    Ok(out)
}

pub async fn get_by_slug_from_id(state: &AppState, project_id: &str) -> Result<Project, AppError> {
    get_by_id(state, project_id).await
}

async fn get_by_id(state: &AppState, project_id: &str) -> Result<Project, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("PROJECT#{project_id}")))
        .key("SK", AttributeValue::S("METADATA".into()))
        .send()
        .await?;
    let item = r.item.ok_or(AppError::NotFound)?;
    project_from_item(&item)
}

fn project_from_item(item: &HashMap<String, AttributeValue>) -> Result<Project, AppError> {
    fn s<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Result<&'a str, AppError> {
        item.get(key)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
            .ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(format!(
                    "project missing field: {key}"
                ))))
            })
    }

    let created_at = chrono::DateTime::parse_from_rfc3339(s(item, "createdAt")?)
        .map_err(|e| AppError::Internal(Box::new(e)))?
        .with_timezone(&Utc);

    Ok(Project {
        id: s(item, "projectId")?.to_string(),
        slug: s(item, "slug")?.to_string(),
        name: s(item, "name")?.to_string(),
        template: s(item, "template")?.to_string(),
        visibility: s(item, "visibility")?.to_string(),
        owner_id: s(item, "ownerId")?.to_string(),
        created_at,
    })
}
