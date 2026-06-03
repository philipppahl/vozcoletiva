use std::collections::HashMap;

use aws_sdk_dynamodb::types::{AttributeValue, KeysAndAttributes, ReturnValue};
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
    /// S3 object key of the avatar (`avatars/<uid>/<ver>.webp`), if set. The
    /// public URL is derived at the DTO layer via `MediaConfig::url_for`.
    pub avatar_key: Option<String>,
    /// The user's unique @handle (lowercase), if picked. Mentions use it.
    pub handle: Option<String>,
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
        avatar_key: None,
        handle: None,
    };

    let put = state
        .ddb
        .put_item()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(pk.clone()))
        .item("SK", AttributeValue::S(sk.clone()))
        .item("type", AttributeValue::S("User".into()))
        .item("userId", AttributeValue::S(profile.user_id.clone()))
        .item(
            "displayName",
            AttributeValue::S(profile.display_name.clone()),
        )
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
                let item = read.item.ok_or_else(|| {
                    AppError::Internal(Box::new(std::io::Error::other(
                        "conditional check failed but item not found on read-back",
                    )))
                })?;
                return profile_from_item(&item);
            }
            Err(AppError::Internal(Box::new(raw)))
        }
    }
}

/// Read a user's profile without creating one. `None` if it doesn't exist.
pub async fn get_profile(state: &AppState, user_id: &str) -> Result<Option<UserProfile>, AppError> {
    let read = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("USER#{user_id}")))
        .key("SK", AttributeValue::S("PROFILE".into()))
        .send()
        .await?;
    match read.item {
        Some(item) => Ok(Some(profile_from_item(&item)?)),
        None => Ok(None),
    }
}

/// Set the caller's display name, creating the profile if it doesn't exist yet
/// (upsert). `locale`/`theme`/`createdAt`/`userId`/`type` are initialised only
/// on first write via `if_not_exists`, so an existing profile keeps its prefs.
/// Returns the updated profile. This is the single bootstrap/edit path for the
/// display name — see decision 0019.
pub async fn upsert_display_name(
    state: &AppState,
    user_id: &str,
    display_name: &str,
) -> Result<UserProfile, AppError> {
    let now = Utc::now();
    let resp = state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("USER#{user_id}")))
        .key("SK", AttributeValue::S("PROFILE".into()))
        .update_expression(
            "SET displayName = :n, \
                 #type = if_not_exists(#type, :user), \
                 userId = if_not_exists(userId, :uid), \
                 locale = if_not_exists(locale, :loc), \
                 theme = if_not_exists(theme, :th), \
                 createdAt = if_not_exists(createdAt, :now)",
        )
        .expression_attribute_names("#type", "type")
        .expression_attribute_values(":n", AttributeValue::S(display_name.to_string()))
        .expression_attribute_values(":user", AttributeValue::S("User".into()))
        .expression_attribute_values(":uid", AttributeValue::S(user_id.to_string()))
        .expression_attribute_values(":loc", AttributeValue::S("en".into()))
        .expression_attribute_values(":th", AttributeValue::S("system".into()))
        .expression_attribute_values(":now", AttributeValue::S(now.to_rfc3339()))
        .return_values(ReturnValue::AllNew)
        .send()
        .await
        .map_err(|e| AppError::Internal(Box::new(e.into_service_error())))?;

    let item = resp.attributes.ok_or_else(|| {
        AppError::Internal(Box::new(std::io::Error::other(
            "update_item returned no attributes",
        )))
    })?;
    profile_from_item(&item)
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
        avatar_key: item.get("avatarKey").and_then(|v| v.as_s().ok()).cloned(),
        handle: item.get("handle").and_then(|v| v.as_s().ok()).cloned(),
    })
}

/// The user that owns a handle (`HANDLE#<handle>/CLAIM`), or None if free.
pub async fn user_by_handle(state: &AppState, handle: &str) -> Result<Option<String>, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("HANDLE#{handle}")))
        .key("SK", AttributeValue::S("CLAIM".into()))
        .send()
        .await?;
    Ok(r.item
        .as_ref()
        .and_then(|i| i.get("userId"))
        .and_then(|v| v.as_s().ok())
        .cloned())
}

/// Claim/change the caller's handle. One transaction: claim the new handle
/// (conditional on it being free), release the old one, and point the profile
/// at the new handle (bootstrapping the profile shell if needed). 409 if taken.
pub async fn set_handle(state: &AppState, user_id: &str, handle: &str) -> Result<(), AppError> {
    let current = get_profile(state, user_id).await?.and_then(|p| p.handle);
    if current.as_deref() == Some(handle) {
        return Ok(()); // no-op
    }
    let now = Utc::now();

    let claim = aws_sdk_dynamodb::types::Put::builder()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(format!("HANDLE#{handle}")))
        .item("SK", AttributeValue::S("CLAIM".into()))
        .item("type", AttributeValue::S("HandleClaim".into()))
        .item("userId", AttributeValue::S(user_id.to_string()))
        .item("createdAt", AttributeValue::S(now.to_rfc3339()))
        .condition_expression("attribute_not_exists(PK)")
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    let profile = aws_sdk_dynamodb::types::Update::builder()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("USER#{user_id}")))
        .key("SK", AttributeValue::S("PROFILE".into()))
        .update_expression(
            "SET #handle = :h, \
                 #type = if_not_exists(#type, :user), \
                 userId = if_not_exists(userId, :uid), \
                 displayName = if_not_exists(displayName, :uid), \
                 locale = if_not_exists(locale, :loc), \
                 theme = if_not_exists(theme, :th), \
                 createdAt = if_not_exists(createdAt, :now)",
        )
        .expression_attribute_names("#handle", "handle")
        .expression_attribute_names("#type", "type")
        .expression_attribute_values(":h", AttributeValue::S(handle.to_string()))
        .expression_attribute_values(":user", AttributeValue::S("User".into()))
        .expression_attribute_values(":uid", AttributeValue::S(user_id.to_string()))
        .expression_attribute_values(":loc", AttributeValue::S("en".into()))
        .expression_attribute_values(":th", AttributeValue::S("system".into()))
        .expression_attribute_values(":now", AttributeValue::S(now.to_rfc3339()))
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    let mut tx = state
        .ddb
        .transact_write_items()
        .transact_items(aws_sdk_dynamodb::types::TransactWriteItem::builder().put(claim).build())
        .transact_items(
            aws_sdk_dynamodb::types::TransactWriteItem::builder()
                .update(profile)
                .build(),
        );
    if let Some(old) = &current {
        let release = aws_sdk_dynamodb::types::Delete::builder()
            .table_name(&state.table_name)
            .key("PK", AttributeValue::S(format!("HANDLE#{old}")))
            .key("SK", AttributeValue::S("CLAIM".into()))
            .build()
            .map_err(|e| AppError::Internal(Box::new(e)))?;
        tx = tx.transact_items(
            aws_sdk_dynamodb::types::TransactWriteItem::builder()
                .delete(release)
                .build(),
        );
    }

    match tx.send().await {
        Ok(_) => Ok(()),
        Err(err) => {
            let svc = err.into_service_error();
            if svc.to_string().contains("ConditionalCheckFailed") {
                Err(AppError::Conflict("handle is already taken".into()))
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

/// Point the profile at a new avatar object. Returns the *previous* key (if any)
/// so the caller can delete the orphaned object. Upserts the profile shell if it
/// somehow doesn't exist yet (mirrors `upsert_display_name`).
pub async fn set_avatar(
    state: &AppState,
    user_id: &str,
    key: &str,
) -> Result<Option<String>, AppError> {
    let now = Utc::now();
    let resp = state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("USER#{user_id}")))
        .key("SK", AttributeValue::S("PROFILE".into()))
        .update_expression(
            "SET avatarKey = :k, \
                 #type = if_not_exists(#type, :user), \
                 userId = if_not_exists(userId, :uid), \
                 displayName = if_not_exists(displayName, :dn), \
                 locale = if_not_exists(locale, :loc), \
                 theme = if_not_exists(theme, :th), \
                 createdAt = if_not_exists(createdAt, :now)",
        )
        .expression_attribute_names("#type", "type")
        .expression_attribute_values(":k", AttributeValue::S(key.to_string()))
        .expression_attribute_values(":user", AttributeValue::S("User".into()))
        .expression_attribute_values(":uid", AttributeValue::S(user_id.to_string()))
        .expression_attribute_values(":dn", AttributeValue::S(user_id.to_string()))
        .expression_attribute_values(":loc", AttributeValue::S("en".into()))
        .expression_attribute_values(":th", AttributeValue::S("system".into()))
        .expression_attribute_values(":now", AttributeValue::S(now.to_rfc3339()))
        .return_values(ReturnValue::UpdatedOld)
        .send()
        .await
        .map_err(|e| AppError::Internal(Box::new(e.into_service_error())))?;
    Ok(resp
        .attributes
        .and_then(|a| a.get("avatarKey").and_then(|v| v.as_s().ok()).cloned()))
}

/// Lightweight per-user fields for list endpoints (avatar + handle).
#[derive(Debug, Clone, Default)]
pub struct ProfileRef {
    pub avatar_key: Option<String>,
    pub handle: Option<String>,
}

/// Resolve avatar keys + handles for a set of users in one batch, so list
/// endpoints can attach them without denormalising (which would go stale on
/// every change).
pub async fn profile_refs(
    state: &AppState,
    user_ids: &[String],
) -> Result<HashMap<String, ProfileRef>, AppError> {
    let mut out = HashMap::new();
    for chunk in user_ids.chunks(100) {
        if chunk.is_empty() {
            continue;
        }
        let keys: Vec<HashMap<String, AttributeValue>> = chunk
            .iter()
            .map(|id| {
                HashMap::from([
                    ("PK".to_string(), AttributeValue::S(format!("USER#{id}"))),
                    ("SK".to_string(), AttributeValue::S("PROFILE".into())),
                ])
            })
            .collect();
        let kaa = KeysAndAttributes::builder()
            .set_keys(Some(keys))
            .projection_expression("userId, avatarKey, #h")
            .expression_attribute_names("#h", "handle")
            .build()
            .map_err(|e| AppError::Internal(Box::new(e)))?;
        let resp = state
            .ddb
            .batch_get_item()
            .request_items(&state.table_name, kaa)
            .send()
            .await?;
        if let Some(items) = resp.responses.and_then(|mut r| r.remove(&state.table_name)) {
            for item in items {
                if let Some(uid) = item.get("userId").and_then(|v| v.as_s().ok()) {
                    out.insert(
                        uid.clone(),
                        ProfileRef {
                            avatar_key: item.get("avatarKey").and_then(|v| v.as_s().ok()).cloned(),
                            handle: item.get("handle").and_then(|v| v.as_s().ok()).cloned(),
                        },
                    );
                }
            }
        }
    }
    Ok(out)
}

/// Clear the avatar. Returns the removed key (if any) for object cleanup.
pub async fn clear_avatar(state: &AppState, user_id: &str) -> Result<Option<String>, AppError> {
    let resp = state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("USER#{user_id}")))
        .key("SK", AttributeValue::S("PROFILE".into()))
        .update_expression("REMOVE avatarKey")
        .return_values(ReturnValue::UpdatedOld)
        .send()
        .await
        .map_err(|e| AppError::Internal(Box::new(e.into_service_error())))?;
    Ok(resp
        .attributes
        .and_then(|a| a.get("avatarKey").and_then(|v| v.as_s().ok()).cloned()))
}
