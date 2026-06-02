use std::collections::HashMap;

use aws_sdk_dynamodb::types::{AttributeValue, Put, Select, TransactWriteItem, Update};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use ulid::Ulid;

use crate::error::AppError;
use crate::state::AppState;

/// A media attachment on a message. `key` is the S3 object key; the public URL
/// is derived at the DTO layer. Stored on the message item as a JSON blob.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Attachment {
    pub kind: String, // "image" | "doc" | "voice"
    pub key: String,
    #[serde(default)]
    pub mime: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub size: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub width: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub height: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub duration_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub parent_message_id: Option<String>,
    pub author_id: String,
    pub author_display_name: String,
    pub body: String,
    pub created_at: String,
    pub reply_count: i64,
    pub last_reply_at: Option<String>,
    pub attachments: Vec<Attachment>,
}

/// Top-level messages live at `MSG#<ulid>`, replies at `REPLY#<ulid>` — so
/// listing a channel's top-level messages is a clean range query with no filter.
fn top_sk(id: &str) -> String {
    format!("MSG#{id}")
}
fn reply_sk(id: &str) -> String {
    format!("REPLY#{id}")
}

/// Post a message. A reply (`parent_message_id`) is written under `REPLY#`,
/// indexed on GSI3 `THREAD#<parent>`, and bumps the parent's reply counters in
/// the same transaction. A top-level message is indexed on GSI3 `MSG#<id>` so it
/// can be resolved to its conversation by id alone. `author_display_name` is
/// denormalised here (the poster's project membership name).
pub async fn post(
    state: &AppState,
    conversation_id: &str,
    author_id: &str,
    author_display_name: &str,
    body: &str,
    parent_message_id: Option<&str>,
    attachments: Vec<Attachment>,
) -> Result<Message, AppError> {
    let id = Ulid::new().to_string();
    let now = Utc::now().to_rfc3339();

    let mut item = HashMap::from([
        (
            "PK".to_string(),
            AttributeValue::S(format!("CONV#{conversation_id}")),
        ),
        ("type".to_string(), AttributeValue::S("Message".into())),
        ("messageId".to_string(), AttributeValue::S(id.clone())),
        (
            "conversationId".to_string(),
            AttributeValue::S(conversation_id.to_string()),
        ),
        (
            "authorId".to_string(),
            AttributeValue::S(author_id.to_string()),
        ),
        (
            "authorDisplayName".to_string(),
            AttributeValue::S(author_display_name.to_string()),
        ),
        ("body".to_string(), AttributeValue::S(body.to_string())),
        ("createdAt".to_string(), AttributeValue::S(now.clone())),
    ]);

    // Attachments are stored as a JSON blob (a list of small maps) on the item.
    if !attachments.is_empty() {
        let json =
            serde_json::to_string(&attachments).map_err(|e| AppError::Internal(Box::new(e)))?;
        item.insert("attachments".to_string(), AttributeValue::S(json));
    }

    let message = Message {
        id: id.clone(),
        conversation_id: conversation_id.to_string(),
        parent_message_id: parent_message_id.map(String::from),
        author_id: author_id.to_string(),
        author_display_name: author_display_name.to_string(),
        body: body.to_string(),
        created_at: now.clone(),
        reply_count: 0,
        last_reply_at: None,
        attachments,
    };

    match parent_message_id {
        Some(parent) => {
            item.insert("SK".to_string(), AttributeValue::S(reply_sk(&id)));
            item.insert(
                "parentMessageId".to_string(),
                AttributeValue::S(parent.to_string()),
            );
            item.insert(
                "GSI3PK".to_string(),
                AttributeValue::S(format!("THREAD#{parent}")),
            );
            item.insert("GSI3SK".to_string(), AttributeValue::S(id.clone()));

            let put_reply = Put::builder()
                .table_name(&state.table_name)
                .set_item(Some(item))
                .build()
                .map_err(|e| AppError::Internal(Box::new(e)))?;
            // Bump the parent's reply counters.
            let bump_parent = Update::builder()
                .table_name(&state.table_name)
                .key("PK", AttributeValue::S(format!("CONV#{conversation_id}")))
                .key("SK", AttributeValue::S(top_sk(parent)))
                .update_expression("ADD replyCount :one SET lastReplyAt = :ts")
                .expression_attribute_values(":one", AttributeValue::N("1".into()))
                .expression_attribute_values(":ts", AttributeValue::S(now))
                .condition_expression("attribute_exists(SK)")
                .build()
                .map_err(|e| AppError::Internal(Box::new(e)))?;
            state
                .ddb
                .transact_write_items()
                .transact_items(TransactWriteItem::builder().put(put_reply).build())
                .transact_items(TransactWriteItem::builder().update(bump_parent).build())
                .send()
                .await?;
        }
        None => {
            item.insert("SK".to_string(), AttributeValue::S(top_sk(&id)));
            item.insert("replyCount".to_string(), AttributeValue::N("0".into()));
            // Resolve message id → conversation for the thread endpoints.
            item.insert("GSI3PK".to_string(), AttributeValue::S(format!("MSG#{id}")));
            item.insert(
                "GSI3SK".to_string(),
                AttributeValue::S(conversation_id.to_string()),
            );
            state
                .ddb
                .put_item()
                .table_name(&state.table_name)
                .set_item(Some(item))
                .send()
                .await?;
        }
    }
    Ok(message)
}

/// The newest page of top-level messages, returned **oldest-first** (chat
/// display order). `before` (a message id) fetches the page of older messages;
/// `has_more` is true when older messages remain. `limit` caps the page size.
pub async fn list_top_level(
    state: &AppState,
    conversation_id: &str,
    before: Option<&str>,
    limit: usize,
) -> Result<(Vec<Message>, bool), AppError> {
    let hi = before.map(top_sk).unwrap_or_else(|| "MSG$".to_string());
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND SK BETWEEN :lo AND :hi")
        .expression_attribute_values(":pk", AttributeValue::S(format!("CONV#{conversation_id}")))
        .expression_attribute_values(":lo", AttributeValue::S("MSG#".into()))
        .expression_attribute_values(":hi", AttributeValue::S(hi))
        .scan_index_forward(false)
        .limit((limit + 2) as i32)
        .send()
        .await?;
    let mut msgs = Vec::new();
    for item in q.items.unwrap_or_default() {
        let m = message_from_item(&item)?;
        if before == Some(m.id.as_str()) {
            continue; // drop the cursor message itself
        }
        msgs.push(m);
    }
    let has_more = msgs.len() > limit;
    msgs.truncate(limit);
    // Collected newest-first for the cursor; return oldest-first for display.
    msgs.reverse();
    Ok((msgs, has_more))
}

/// A top-level message resolved by its id alone (via GSI3 `MSG#<id>`).
pub async fn top_level_by_id(state: &AppState, message_id: &str) -> Result<Message, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .index_name("GSI3")
        .key_condition_expression("GSI3PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S(format!("MSG#{message_id}")))
        .limit(1)
        .send()
        .await?;
    let item = q
        .items
        .and_then(|mut v| v.pop())
        .ok_or(AppError::NotFound)?;
    message_from_item(&item)
}

/// A thread's replies, chronological.
pub async fn thread_replies(
    state: &AppState,
    parent_message_id: &str,
) -> Result<Vec<Message>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .index_name("GSI3")
        .key_condition_expression("GSI3PK = :pk")
        .expression_attribute_values(
            ":pk",
            AttributeValue::S(format!("THREAD#{parent_message_id}")),
        )
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        out.push(message_from_item(&item)?);
    }
    Ok(out)
}

/// The newest top-level message in a conversation, if any.
pub async fn last_message(
    state: &AppState,
    conversation_id: &str,
) -> Result<Option<Message>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND SK BETWEEN :lo AND :hi")
        .expression_attribute_values(":pk", AttributeValue::S(format!("CONV#{conversation_id}")))
        .expression_attribute_values(":lo", AttributeValue::S("MSG#".into()))
        .expression_attribute_values(":hi", AttributeValue::S("MSG$".into()))
        .scan_index_forward(false)
        .limit(1)
        .send()
        .await?;
    q.items
        .and_then(|mut v| v.pop())
        .map(|i| message_from_item(&i))
        .transpose()
}

/// Count of top-level messages newer than the user's read marker (`last_read_id`
/// is a message id, or `None` for "never read" = all).
pub async fn unread_count(
    state: &AppState,
    conversation_id: &str,
    last_read_id: Option<&str>,
) -> Result<i64, AppError> {
    let lo = last_read_id
        .map(top_sk)
        .unwrap_or_else(|| "MSG#".to_string());
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND SK BETWEEN :lo AND :hi")
        .expression_attribute_values(":pk", AttributeValue::S(format!("CONV#{conversation_id}")))
        .expression_attribute_values(":lo", AttributeValue::S(lo))
        .expression_attribute_values(":hi", AttributeValue::S("MSG$".into()))
        .select(Select::Count)
        .send()
        .await?;
    // When there's a marker the range is inclusive of the marker message itself.
    let count = q.count() as i64;
    Ok(if last_read_id.is_some() {
        (count - 1).max(0)
    } else {
        count
    })
}

fn message_from_item(item: &HashMap<String, AttributeValue>) -> Result<Message, AppError> {
    fn s<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Result<&'a str, AppError> {
        item.get(key)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
            .ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(format!(
                    "message missing field: {key}"
                ))))
            })
    }
    fn s_opt<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Option<&'a str> {
        item.get(key)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
    }
    Ok(Message {
        id: s(item, "messageId")?.to_string(),
        conversation_id: s(item, "conversationId")?.to_string(),
        parent_message_id: s_opt(item, "parentMessageId").map(String::from),
        author_id: s(item, "authorId")?.to_string(),
        author_display_name: s(item, "authorDisplayName")?.to_string(),
        body: s(item, "body")?.to_string(),
        created_at: s(item, "createdAt")?.to_string(),
        reply_count: item
            .get("replyCount")
            .and_then(|v| v.as_n().ok())
            .and_then(|n| n.parse().ok())
            .unwrap_or(0),
        last_reply_at: s_opt(item, "lastReplyAt").map(String::from),
        attachments: s_opt(item, "attachments")
            .and_then(|j| serde_json::from_str(j).ok())
            .unwrap_or_default(),
    })
}
