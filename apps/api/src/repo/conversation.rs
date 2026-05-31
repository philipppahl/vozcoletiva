use std::collections::HashMap;

use aws_sdk_dynamodb::types::AttributeValue;
use serde::Serialize;
use ulid::Ulid;

use crate::error::AppError;
use crate::state::AppState;

/// A channel conversation. (DMs — user-pair conversations — are a later slice.)
#[derive(Debug, Clone, Serialize)]
pub struct Conversation {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
}

/// A fresh channel (new ULID), not yet persisted.
pub fn new_channel(project_id: &str, name: &str, description: Option<String>) -> Conversation {
    Conversation {
        id: Ulid::new().to_string(),
        project_id: project_id.to_string(),
        name: name.to_string(),
        description,
    }
}

/// The `CONV#<id>/META` item (the conversation's home record).
pub fn meta_item(c: &Conversation, created_at: &str) -> HashMap<String, AttributeValue> {
    let mut m = HashMap::from([
        (
            "PK".to_string(),
            AttributeValue::S(format!("CONV#{}", c.id)),
        ),
        ("SK".to_string(), AttributeValue::S("META".into())),
        ("type".to_string(), AttributeValue::S("Channel".into())),
        (
            "conversationId".to_string(),
            AttributeValue::S(c.id.clone()),
        ),
        (
            "projectId".to_string(),
            AttributeValue::S(c.project_id.clone()),
        ),
        ("name".to_string(), AttributeValue::S(c.name.clone())),
        (
            "createdAt".to_string(),
            AttributeValue::S(created_at.to_string()),
        ),
    ]);
    if let Some(d) = &c.description {
        m.insert("description".to_string(), AttributeValue::S(d.clone()));
    }
    m
}

/// The `PROJECT#<pid>/CONV#<id>` pointer item — denormalises name/description so
/// listing a project's channels is one query (no per-channel GetItem).
pub fn pointer_item(c: &Conversation, created_at: &str) -> HashMap<String, AttributeValue> {
    let mut m = HashMap::from([
        (
            "PK".to_string(),
            AttributeValue::S(format!("PROJECT#{}", c.project_id)),
        ),
        (
            "SK".to_string(),
            AttributeValue::S(format!("CONV#{}", c.id)),
        ),
        (
            "type".to_string(),
            AttributeValue::S("ChannelPointer".into()),
        ),
        (
            "conversationId".to_string(),
            AttributeValue::S(c.id.clone()),
        ),
        (
            "projectId".to_string(),
            AttributeValue::S(c.project_id.clone()),
        ),
        ("name".to_string(), AttributeValue::S(c.name.clone())),
        (
            "createdAt".to_string(),
            AttributeValue::S(created_at.to_string()),
        ),
    ]);
    if let Some(d) = &c.description {
        m.insert("description".to_string(), AttributeValue::S(d.clone()));
    }
    m
}

pub async fn list_channels(
    state: &AppState,
    project_id: &str,
) -> Result<Vec<Conversation>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("PROJECT#{project_id}")))
        .expression_attribute_values(":sk", AttributeValue::S("CONV#".into()))
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        out.push(conversation_from_item(&item)?);
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

pub async fn get(state: &AppState, conversation_id: &str) -> Result<Conversation, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("CONV#{conversation_id}")))
        .key("SK", AttributeValue::S("META".into()))
        .send()
        .await?;
    conversation_from_item(&r.item.ok_or(AppError::NotFound)?)
}

// ── read markers ────────────────────────────────────────────────────────────

/// The last-read message id for a user in a conversation, if any.
pub async fn conversation_read(
    state: &AppState,
    user_id: &str,
    conversation_id: &str,
) -> Result<Option<String>, AppError> {
    last_read(state, user_id, &format!("CONVREAD#{conversation_id}")).await
}

pub async fn set_conversation_read(
    state: &AppState,
    user_id: &str,
    conversation_id: &str,
    message_id: &str,
    at: &str,
) -> Result<(), AppError> {
    set_read(
        state,
        user_id,
        &format!("CONVREAD#{conversation_id}"),
        message_id,
        at,
    )
    .await
}

pub async fn set_thread_read(
    state: &AppState,
    user_id: &str,
    parent_message_id: &str,
    message_id: &str,
    at: &str,
) -> Result<(), AppError> {
    set_read(
        state,
        user_id,
        &format!("THREADREAD#{parent_message_id}"),
        message_id,
        at,
    )
    .await
}

async fn last_read(state: &AppState, user_id: &str, sk: &str) -> Result<Option<String>, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("USER#{user_id}")))
        .key("SK", AttributeValue::S(sk.to_string()))
        .send()
        .await?;
    Ok(r.item
        .as_ref()
        .and_then(|i| i.get("lastReadMessageId"))
        .and_then(|v| v.as_s().ok())
        .cloned())
}

async fn set_read(
    state: &AppState,
    user_id: &str,
    sk: &str,
    message_id: &str,
    at: &str,
) -> Result<(), AppError> {
    state
        .ddb
        .put_item()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(format!("USER#{user_id}")))
        .item("SK", AttributeValue::S(sk.to_string()))
        .item("type", AttributeValue::S("ReadMarker".into()))
        .item(
            "lastReadMessageId",
            AttributeValue::S(message_id.to_string()),
        )
        .item("at", AttributeValue::S(at.to_string()))
        .send()
        .await?;
    Ok(())
}

fn conversation_from_item(
    item: &HashMap<String, AttributeValue>,
) -> Result<Conversation, AppError> {
    fn s<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Result<&'a str, AppError> {
        item.get(key)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
            .ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(format!(
                    "conversation missing field: {key}"
                ))))
            })
    }
    Ok(Conversation {
        id: s(item, "conversationId")?.to_string(),
        project_id: s(item, "projectId")?.to_string(),
        name: s(item, "name")?.to_string(),
        description: item.get("description").and_then(|v| v.as_s().ok()).cloned(),
    })
}

/// Create the default "Commons" channel — used by `project::create`'s
/// transaction (so it matches the default topic name). Returns the Put items.
pub fn default_channel_items(
    project_id: &str,
    created_at: &str,
) -> (
    Conversation,
    HashMap<String, AttributeValue>,
    HashMap<String, AttributeValue>,
) {
    let c = new_channel(project_id, "Commons", None);
    let meta = meta_item(&c, created_at);
    let pointer = pointer_item(&c, created_at);
    (c, meta, pointer)
}
