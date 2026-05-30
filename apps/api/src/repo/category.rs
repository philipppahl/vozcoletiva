use std::collections::HashMap;

use aws_sdk_dynamodb::types::{AttributeValue, Select};
use chrono::Utc;
use serde::Serialize;
use ulid::Ulid;

use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct Category {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub position: i64,
    pub created_at: String,
}

fn key(project_id: &str, id: &str) -> (AttributeValue, AttributeValue) {
    (
        AttributeValue::S(format!("PROJECT#{project_id}")),
        AttributeValue::S(format!("TOPIC#{id}")),
    )
}

/// The DynamoDB item attributes for a category. Shared between the standalone
/// `create` (PutItem) and `project::create` (a `Put` in its transaction), so the
/// default category can be minted in the project-creation transaction.
pub fn item_map(cat: &Category) -> HashMap<String, AttributeValue> {
    let (pk, sk) = key(&cat.project_id, &cat.id);
    HashMap::from([
        ("PK".to_string(), pk),
        ("SK".to_string(), sk),
        ("type".to_string(), AttributeValue::S("Category".into())),
        ("categoryId".to_string(), AttributeValue::S(cat.id.clone())),
        (
            "projectId".to_string(),
            AttributeValue::S(cat.project_id.clone()),
        ),
        ("name".to_string(), AttributeValue::S(cat.name.clone())),
        (
            "position".to_string(),
            AttributeValue::N(cat.position.to_string()),
        ),
        (
            "createdAt".to_string(),
            AttributeValue::S(cat.created_at.clone()),
        ),
    ])
}

/// A fresh category (new ULID + now), without persisting it.
pub fn new_category(project_id: &str, name: &str, position: i64) -> Category {
    Category {
        id: Ulid::new().to_string(),
        project_id: project_id.to_string(),
        name: name.to_string(),
        position,
        created_at: Utc::now().to_rfc3339(),
    }
}

pub async fn create(
    state: &AppState,
    project_id: &str,
    name: &str,
    position: i64,
) -> Result<Category, AppError> {
    let cat = new_category(project_id, name, position);
    state
        .ddb
        .put_item()
        .table_name(&state.table_name)
        .set_item(Some(item_map(&cat)))
        .condition_expression("attribute_not_exists(SK)")
        .send()
        .await?;
    Ok(cat)
}

pub async fn list_for_project(
    state: &AppState,
    project_id: &str,
) -> Result<Vec<Category>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("PROJECT#{project_id}")))
        .expression_attribute_values(":sk", AttributeValue::S("TOPIC#".into()))
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        out.push(category_from_item(&item)?);
    }
    out.sort_by_key(|c| c.position);
    Ok(out)
}

pub async fn get(state: &AppState, project_id: &str, id: &str) -> Result<Category, AppError> {
    let (pk, sk) = key(project_id, id);
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", pk)
        .key("SK", sk)
        .send()
        .await?;
    category_from_item(&r.item.ok_or(AppError::NotFound)?)
}

/// The first category by position — the server-side default when a proposal
/// doesn't name one.
pub async fn default_for(state: &AppState, project_id: &str) -> Result<Category, AppError> {
    list_for_project(state, project_id)
        .await?
        .into_iter()
        .next()
        .ok_or(AppError::NotFound)
}

pub async fn rename(
    state: &AppState,
    project_id: &str,
    id: &str,
    name: &str,
) -> Result<(), AppError> {
    let (pk, sk) = key(project_id, id);
    state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", pk)
        .key("SK", sk)
        .update_expression("SET #n = :name")
        .expression_attribute_names("#n", "name")
        .expression_attribute_values(":name", AttributeValue::S(name.to_string()))
        .condition_expression("attribute_exists(SK)")
        .send()
        .await?;
    Ok(())
}

pub async fn delete(state: &AppState, project_id: &str, id: &str) -> Result<(), AppError> {
    let (pk, sk) = key(project_id, id);
    state
        .ddb
        .delete_item()
        .table_name(&state.table_name)
        .key("PK", pk)
        .key("SK", sk)
        .send()
        .await?;
    Ok(())
}

/// How many proposals in the project reference this category. Used by the
/// delete guard (a category with proposals can't be removed).
pub async fn count_referencing(
    state: &AppState,
    project_id: &str,
    category_id: &str,
) -> Result<i64, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .filter_expression("categoryId = :c")
        .expression_attribute_values(":pk", AttributeValue::S(format!("PROJECT#{project_id}")))
        .expression_attribute_values(":sk", AttributeValue::S("PROPOSAL#".into()))
        .expression_attribute_values(":c", AttributeValue::S(category_id.to_string()))
        .select(Select::Count)
        .send()
        .await?;
    Ok(q.count() as i64)
}

fn category_from_item(item: &HashMap<String, AttributeValue>) -> Result<Category, AppError> {
    fn s<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Result<&'a str, AppError> {
        item.get(key)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
            .ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(format!(
                    "category missing field: {key}"
                ))))
            })
    }
    Ok(Category {
        id: s(item, "categoryId")?.to_string(),
        project_id: s(item, "projectId")?.to_string(),
        name: s(item, "name")?.to_string(),
        position: item
            .get("position")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0),
        created_at: s(item, "createdAt")?.to_string(),
    })
}
