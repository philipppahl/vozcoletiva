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

/// An immutable snapshot of the message a reply quotes (decision 0031). Captured
/// at write time so the quote header survives the original being edited/deleted
/// and needs no extra read on display. `author_id` is internal (used for the
/// "someone replied to you" notification); it isn't exposed to clients.
#[derive(Debug, Clone, Serialize)]
pub struct ReplyTo {
    pub id: String,
    pub author_id: String,
    pub author_display_name: String,
    pub preview: String,
    pub kind: String, // "text" | "image" | "doc" | "voice"
}

#[derive(Debug, Clone, Serialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    /// The quoted message, when this is a reply (decision 0031). Replies live
    /// inline in the timeline; the parent also accrues `reply_count`.
    pub reply_to: Option<ReplyTo>,
    pub author_id: String,
    pub author_display_name: String,
    pub body: String,
    pub created_at: String,
    pub reply_count: i64,
    pub last_reply_at: Option<String>,
    pub attachments: Vec<Attachment>,
    /// Materialised reaction tallies (emoji → count), bumped transactionally as
    /// people react (decision 0031). The viewer's own reactions ("me") come from
    /// a separate small lookup, not this map.
    pub reaction_counts: HashMap<String, i64>,
}

/// Every message — top-level or reply — lives at `MSG#<ulid>`, so the timeline is
/// one clean range query that includes replies inline (decision 0031). A reply
/// just carries `replyToId` + a quote snapshot and bumps its parent's counters.
fn msg_sk(id: &str) -> String {
    format!("MSG#{id}")
}

/// Post a message. Every message is a `MSG#<ulid>` item indexed on GSI3
/// `MSG#<id>` → conversation (resolve-by-id). A **reply** (`reply_to`) lives
/// inline in the timeline like any message, carries an immutable quote snapshot,
/// and bumps its parent's `replyCount`/`lastReplyAt` in the same transaction.
/// `author_display_name` is denormalised here (the poster's membership name).
pub async fn post(
    state: &AppState,
    conversation_id: &str,
    author_id: &str,
    author_display_name: &str,
    body: &str,
    reply_to: Option<ReplyTo>,
    attachments: Vec<Attachment>,
) -> Result<Message, AppError> {
    let id = Ulid::new().to_string();
    let now = Utc::now().to_rfc3339();

    let mut item = HashMap::from([
        (
            "PK".to_string(),
            AttributeValue::S(format!("CONV#{conversation_id}")),
        ),
        ("SK".to_string(), AttributeValue::S(msg_sk(&id))),
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
        ("replyCount".to_string(), AttributeValue::N("0".into())),
        // Present from birth so reaction `ADD reactionCounts.<emoji>` updates work.
        ("reactionCounts".to_string(), AttributeValue::M(HashMap::new())),
        // Resolve message id → conversation for the by-id + thread endpoints.
        ("GSI3PK".to_string(), AttributeValue::S(format!("MSG#{id}"))),
        (
            "GSI3SK".to_string(),
            AttributeValue::S(conversation_id.to_string()),
        ),
    ]);

    // Attachments are stored as a JSON blob (a list of small maps) on the item.
    if !attachments.is_empty() {
        let json =
            serde_json::to_string(&attachments).map_err(|e| AppError::Internal(Box::new(e)))?;
        item.insert("attachments".to_string(), AttributeValue::S(json));
    }

    // Denormalise the quote snapshot onto the reply.
    if let Some(rt) = &reply_to {
        item.insert("replyToId".to_string(), AttributeValue::S(rt.id.clone()));
        item.insert(
            "replyToAuthorId".to_string(),
            AttributeValue::S(rt.author_id.clone()),
        );
        item.insert(
            "replyToAuthor".to_string(),
            AttributeValue::S(rt.author_display_name.clone()),
        );
        item.insert(
            "replyToPreview".to_string(),
            AttributeValue::S(rt.preview.clone()),
        );
        item.insert(
            "replyToKind".to_string(),
            AttributeValue::S(rt.kind.clone()),
        );
    }

    let message = Message {
        id: id.clone(),
        conversation_id: conversation_id.to_string(),
        reply_to: reply_to.clone(),
        author_id: author_id.to_string(),
        author_display_name: author_display_name.to_string(),
        body: body.to_string(),
        created_at: now.clone(),
        reply_count: 0,
        last_reply_at: None,
        attachments,
        reaction_counts: HashMap::new(),
    };

    match &reply_to {
        Some(rt) => {
            let put_reply = Put::builder()
                .table_name(&state.table_name)
                .set_item(Some(item))
                .build()
                .map_err(|e| AppError::Internal(Box::new(e)))?;
            // Bump the quoted message's reply counters (it stays a normal MSG#).
            let bump_parent = Update::builder()
                .table_name(&state.table_name)
                .key("PK", AttributeValue::S(format!("CONV#{conversation_id}")))
                .key("SK", AttributeValue::S(msg_sk(&rt.id)))
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

/// The newest page of messages, returned **oldest-first** (chat display order).
/// Includes replies inline (decision 0031). `before` (a message id) fetches the
/// page of older messages; `has_more` is true when older messages remain.
pub async fn list(
    state: &AppState,
    conversation_id: &str,
    before: Option<&str>,
    limit: usize,
) -> Result<(Vec<Message>, bool), AppError> {
    let hi = before.map(msg_sk).unwrap_or_else(|| "MSG$".to_string());
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

/// A message fetched directly + **strongly consistently** by its conversation +
/// id. Use right after a write (e.g. a reaction toggle) where the GSI's eventual
/// consistency would return a stale copy. Returns `None` if absent.
pub async fn get_in_conversation(
    state: &AppState,
    conversation_id: &str,
    message_id: &str,
) -> Result<Option<Message>, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("CONV#{conversation_id}")))
        .key("SK", AttributeValue::S(msg_sk(message_id)))
        .consistent_read(true)
        .send()
        .await?;
    r.item.as_ref().map(message_from_item).transpose()
}

/// Any message resolved by its id alone (via GSI3 `MSG#<id>`).
pub async fn message_by_id(state: &AppState, message_id: &str) -> Result<Message, AppError> {
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

/// A message's direct replies, chronological. Filters the conversation's
/// messages by `replyToId` — the focused-thread view is opened on demand, and
/// our channels are bounded, so a filtered query is fine (revisit with a GSI if
/// channels grow large). See decision 0031.
pub async fn thread_replies(
    state: &AppState,
    conversation_id: &str,
    parent_message_id: &str,
) -> Result<Vec<Message>, AppError> {
    let mut out = Vec::new();
    let mut start_key = None;
    loop {
        let q = state
            .ddb
            .query()
            .table_name(&state.table_name)
            .key_condition_expression("PK = :pk AND SK BETWEEN :lo AND :hi")
            .filter_expression("replyToId = :parent")
            .expression_attribute_values(
                ":pk",
                AttributeValue::S(format!("CONV#{conversation_id}")),
            )
            .expression_attribute_values(":lo", AttributeValue::S("MSG#".into()))
            .expression_attribute_values(":hi", AttributeValue::S("MSG$".into()))
            .expression_attribute_values(
                ":parent",
                AttributeValue::S(parent_message_id.to_string()),
            )
            .set_exclusive_start_key(start_key)
            .send()
            .await?;
        for item in q.items.unwrap_or_default() {
            out.push(message_from_item(&item)?);
        }
        start_key = q.last_evaluated_key;
        if start_key.is_none() {
            break;
        }
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
        .map(msg_sk)
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
    // The quote snapshot is present iff this message is a reply (decision 0031).
    let reply_to = s_opt(item, "replyToId").map(|id| ReplyTo {
        id: id.to_string(),
        author_id: s_opt(item, "replyToAuthorId").unwrap_or_default().to_string(),
        author_display_name: s_opt(item, "replyToAuthor").unwrap_or_default().to_string(),
        preview: s_opt(item, "replyToPreview").unwrap_or_default().to_string(),
        kind: s_opt(item, "replyToKind").unwrap_or("text").to_string(),
    });
    Ok(Message {
        id: s(item, "messageId")?.to_string(),
        conversation_id: s(item, "conversationId")?.to_string(),
        reply_to,
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
        reaction_counts: item
            .get("reactionCounts")
            .and_then(|v| v.as_m().ok())
            .map(|m| {
                m.iter()
                    .filter_map(|(k, v)| {
                        v.as_n().ok().and_then(|n| n.parse::<i64>().ok()).map(|c| (k.clone(), c))
                    })
                    .filter(|(_, c)| *c > 0)
                    .collect()
            })
            .unwrap_or_default(),
    })
}
