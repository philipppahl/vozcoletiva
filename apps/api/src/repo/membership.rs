use std::collections::HashMap;

use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::domain::role::Role;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct Membership {
    pub project_id: String,
    pub user_id: String,
    pub display_name: String,
    pub role: Role,
    pub joined_at: DateTime<Utc>,
}

/// Idempotently add a membership. If one already exists for (project, user),
/// no-op and return the existing record.
pub async fn add(
    state: &AppState,
    project_id: &str,
    user_id: &str,
    display_name: &str,
    role: Role,
) -> Result<Membership, AppError> {
    let pk = format!("PROJECT#{project_id}");
    let sk = format!("MEMBER#{user_id}");
    let now = Utc::now();

    let result = state
        .ddb
        .put_item()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(pk.clone()))
        .item("SK", AttributeValue::S(sk.clone()))
        .item("type", AttributeValue::S("Membership".into()))
        .item("projectId", AttributeValue::S(project_id.to_string()))
        .item("userId", AttributeValue::S(user_id.to_string()))
        .item("role", AttributeValue::S(role.as_str().into()))
        .item("displayName", AttributeValue::S(display_name.into()))
        .item("joinedAt", AttributeValue::S(now.to_rfc3339()))
        .item(
            "GSI1PK",
            AttributeValue::S(format!("USER#{user_id}")),
        )
        .item(
            "GSI1SK",
            AttributeValue::S(format!("MEMBER#{project_id}")),
        )
        .condition_expression("attribute_not_exists(PK)")
        .send()
        .await;

    match result {
        Ok(_) => Ok(Membership {
            project_id: project_id.to_string(),
            user_id: user_id.to_string(),
            display_name: display_name.to_string(),
            role,
            joined_at: now,
        }),
        Err(err) => {
            let svc = err.into_service_error();
            if svc.is_conditional_check_failed_exception() {
                // Already a member — read and return.
                get(state, project_id, user_id).await
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

pub async fn get(
    state: &AppState,
    project_id: &str,
    user_id: &str,
) -> Result<Membership, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("PROJECT#{project_id}")))
        .key("SK", AttributeValue::S(format!("MEMBER#{user_id}")))
        .send()
        .await?;
    let item = r.item.ok_or(AppError::NotFound)?;
    membership_from_item(&item)
}

pub async fn list(state: &AppState, project_id: &str) -> Result<Vec<Membership>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .expression_attribute_values(
            ":pk",
            AttributeValue::S(format!("PROJECT#{project_id}")),
        )
        .expression_attribute_values(":sk", AttributeValue::S("MEMBER#".into()))
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        out.push(membership_from_item(&item)?);
    }
    Ok(out)
}

fn membership_from_item(
    item: &HashMap<String, AttributeValue>,
) -> Result<Membership, AppError> {
    fn s<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Result<&'a str, AppError> {
        item.get(key)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
            .ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(format!(
                    "membership missing field: {key}"
                ))))
            })
    }

    let joined_at = chrono::DateTime::parse_from_rfc3339(s(item, "joinedAt")?)
        .map_err(|e| AppError::Internal(Box::new(e)))?
        .with_timezone(&Utc);
    let role: Role = s(item, "role")?.parse()?;

    Ok(Membership {
        project_id: s(item, "projectId")?.to_string(),
        user_id: s(item, "userId")?.to_string(),
        display_name: s(item, "displayName")?.to_string(),
        role,
        joined_at,
    })
}
