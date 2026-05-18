use std::collections::HashMap;

use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub user_id: String,
    pub display_name: String,
    pub locale: String,
    pub theme: String,
    pub created_at: DateTime<Utc>,
}

/// First sign-in: create the user's profile if it doesn't already exist;
/// return the (existing or newly created) profile.
///
/// The `attribute_not_exists(PK)` condition makes this idempotent under
/// concurrent first calls — exactly one writer wins, the other reads back.
pub async fn get_or_create_profile(
    state: &AppState,
    user_id: &str,
    fallback_display_name: &str,
) -> Result<UserProfile, AppError> {
    let pk = format!("USER#{user_id}");
    let sk = "PROFILE".to_string();

    // Try to read first.
    let read = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(pk.clone()))
        .key("SK", AttributeValue::S(sk.clone()))
        .send()
        .await?;

    if let Some(item) = read.item {
        return profile_from_item(&item);
    }

    // Not present — create it.
    let now = Utc::now();
    let profile = UserProfile {
        user_id: user_id.to_string(),
        display_name: fallback_display_name.to_string(),
        locale: "en".to_string(),
        theme: "system".to_string(),
        created_at: now,
    };

    let put = state
        .ddb
        .put_item()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(pk.clone()))
        .item("SK", AttributeValue::S(sk.clone()))
        .item("type", AttributeValue::S("User".into()))
        .item("userId", AttributeValue::S(profile.user_id.clone()))
        .item("displayName", AttributeValue::S(profile.display_name.clone()))
        .item("locale", AttributeValue::S(profile.locale.clone()))
        .item("theme", AttributeValue::S(profile.theme.clone()))
        .item("createdAt", AttributeValue::S(now.to_rfc3339()))
        .condition_expression("attribute_not_exists(PK)")
        .send()
        .await;

    match put {
        Ok(_) => Ok(profile),
        Err(err) => {
            // Lost the race — another invocation just created the profile.
            // Re-read and return the canonical version.
            let raw = err.into_service_error();
            if raw.is_conditional_check_failed_exception() {
                let read = state
                    .ddb
                    .get_item()
                    .table_name(&state.table_name)
                    .key("PK", AttributeValue::S(pk))
                    .key("SK", AttributeValue::S(sk))
                    .send()
                    .await?;
                let item = read
                    .item
                    .ok_or_else(|| AppError::Internal(Box::new(std::io::Error::other(
                        "conditional check failed but item not found on read-back",
                    ))))?;
                return profile_from_item(&item);
            }
            Err(AppError::Internal(Box::new(raw)))
        }
    }
}

fn profile_from_item(item: &HashMap<String, AttributeValue>) -> Result<UserProfile, AppError> {
    fn s<'a>(item: &'a HashMap<String, AttributeValue>, name: &str) -> Result<&'a str, AppError> {
        item.get(name)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
            .ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(format!(
                    "user profile missing string field: {name}"
                ))))
            })
    }

    let created_at = chrono::DateTime::parse_from_rfc3339(s(item, "createdAt")?)
        .map_err(|e| AppError::Internal(Box::new(e)))?
        .with_timezone(&Utc);

    Ok(UserProfile {
        user_id: s(item, "userId")?.to_string(),
        display_name: s(item, "displayName")?.to_string(),
        locale: s(item, "locale")?.to_string(),
        theme: s(item, "theme")?.to_string(),
        created_at,
    })
}
