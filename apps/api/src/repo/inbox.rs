//! Inbox items — denormalised "this needs you" notifications, fanned out on
//! write (one item per recipient). See decision 0021.

use std::collections::HashMap;

use aws_sdk_dynamodb::types::{AttributeValue, PutRequest, Select, WriteRequest};
use serde::Serialize;
use ulid::Ulid;

use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum InboxKind {
    Mention,
    Reply,
    CommentOnYours,
    ProposalClosed,
    DocumentAmended,
}

impl InboxKind {
    pub fn wire(self) -> &'static str {
        match self {
            InboxKind::Mention => "mention",
            InboxKind::Reply => "reply",
            InboxKind::CommentOnYours => "comment-on-yours",
            InboxKind::ProposalClosed => "proposal-closed",
            InboxKind::DocumentAmended => "document-amended",
        }
    }
}

/// A notification to write to one recipient's inbox. The actor + project fields
/// are denormalised so reads need no joins (stale-on-rename is fine here).
#[derive(Debug, Clone)]
pub struct NewInboxItem {
    pub recipient_id: String,
    pub kind: InboxKind,
    pub project_id: String,
    pub project_slug: String,
    pub project_name: String,
    pub actor_id: String,
    pub actor_display_name: Option<String>,
    pub proposal_id: Option<String>,
    pub comment_id: Option<String>,
    pub conversation_id: Option<String>,
    pub message_id: Option<String>,
    pub document_name: Option<String>,
    pub preview: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct InboxItem {
    pub id: String,
    pub kind: String,
    pub project_id: String,
    pub project_slug: String,
    pub project_name: String,
    pub actor_id: String,
    pub actor_display_name: Option<String>,
    pub proposal_id: Option<String>,
    pub comment_id: Option<String>,
    pub conversation_id: Option<String>,
    pub message_id: Option<String>,
    pub document_name: Option<String>,
    pub preview: String,
    pub created_at: String,
    pub read_at: Option<String>,
}

/// Fan-out write: one `USER#<recipient>/INBOX#<ulid>` item each, in batches of
/// 25 (the BatchWriteItem cap). No-op for an empty list.
pub async fn add_items(state: &AppState, items: Vec<NewInboxItem>) -> Result<(), AppError> {
    for chunk in items.chunks(25) {
        let mut requests = Vec::with_capacity(chunk.len());
        for item in chunk {
            let put = PutRequest::builder()
                .set_item(Some(to_item(item)))
                .build()
                .map_err(|e| AppError::Internal(Box::new(e)))?;
            requests.push(WriteRequest::builder().put_request(put).build());
        }
        state
            .ddb
            .batch_write_item()
            .request_items(&state.table_name, requests)
            .send()
            .await?;
    }
    Ok(())
}

/// A user's inbox, newest-first. `before` (an item id) pages older; `limit`
/// caps the page.
pub async fn list(
    state: &AppState,
    user_id: &str,
    before: Option<&str>,
    limit: usize,
) -> Result<Vec<InboxItem>, AppError> {
    let hi = before
        .map(|b| format!("INBOX#{b}"))
        .unwrap_or_else(|| "INBOX$".to_string());
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND SK BETWEEN :lo AND :hi")
        .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{user_id}")))
        .expression_attribute_values(":lo", AttributeValue::S("INBOX#".into()))
        .expression_attribute_values(":hi", AttributeValue::S(hi))
        .scan_index_forward(false)
        .limit((limit + 1) as i32)
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        let parsed = from_item(&item)?;
        if before == Some(parsed.id.as_str()) {
            continue; // drop the cursor item itself
        }
        out.push(parsed);
    }
    out.truncate(limit);
    Ok(out)
}

/// Count of unread items (no `readAt`).
pub async fn unread_count(state: &AppState, user_id: &str) -> Result<i64, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .filter_expression("attribute_not_exists(readAt)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{user_id}")))
        .expression_attribute_values(":sk", AttributeValue::S("INBOX#".into()))
        .select(Select::Count)
        .send()
        .await?;
    Ok(q.count() as i64)
}

/// Mark one item read. `false` if it doesn't exist (so the handler can 404).
pub async fn mark_read(
    state: &AppState,
    user_id: &str,
    item_id: &str,
    at: &str,
) -> Result<bool, AppError> {
    let r = state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("USER#{user_id}")))
        .key("SK", AttributeValue::S(format!("INBOX#{item_id}")))
        .update_expression("SET readAt = :at")
        .condition_expression("attribute_exists(SK)")
        .expression_attribute_values(":at", AttributeValue::S(at.to_string()))
        .send()
        .await;
    match r {
        Ok(_) => Ok(true),
        Err(err) => {
            let svc = err.into_service_error();
            if svc.is_conditional_check_failed_exception() {
                Ok(false)
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

/// Mark every unread item read. Loops `UpdateItem` (not batchable) — fine at
/// MVP inbox sizes.
pub async fn mark_all_read(state: &AppState, user_id: &str, at: &str) -> Result<(), AppError> {
    let unread = list_unread_ids(state, user_id).await?;
    for id in unread {
        mark_read(state, user_id, &id, at).await?;
    }
    Ok(())
}

async fn list_unread_ids(state: &AppState, user_id: &str) -> Result<Vec<String>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .filter_expression("attribute_not_exists(readAt)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{user_id}")))
        .expression_attribute_values(":sk", AttributeValue::S("INBOX#".into()))
        .projection_expression("itemId")
        .send()
        .await?;
    let mut ids = Vec::new();
    for item in q.items.unwrap_or_default() {
        if let Some(id) = item.get("itemId").and_then(|v| v.as_s().ok()) {
            ids.push(id.clone());
        }
    }
    Ok(ids)
}

fn to_item(item: &NewInboxItem) -> HashMap<String, AttributeValue> {
    let id = Ulid::new().to_string();
    let mut m = HashMap::from([
        (
            "PK".to_string(),
            AttributeValue::S(format!("USER#{}", item.recipient_id)),
        ),
        ("SK".to_string(), AttributeValue::S(format!("INBOX#{id}"))),
        ("type".to_string(), AttributeValue::S("InboxItem".into())),
        ("itemId".to_string(), AttributeValue::S(id)),
        ("kind".to_string(), AttributeValue::S(item.kind.wire().into())),
        (
            "projectId".to_string(),
            AttributeValue::S(item.project_id.clone()),
        ),
        (
            "projectSlug".to_string(),
            AttributeValue::S(item.project_slug.clone()),
        ),
        (
            "projectName".to_string(),
            AttributeValue::S(item.project_name.clone()),
        ),
        (
            "actorId".to_string(),
            AttributeValue::S(item.actor_id.clone()),
        ),
        (
            "preview".to_string(),
            AttributeValue::S(item.preview.clone()),
        ),
        (
            "createdAt".to_string(),
            AttributeValue::S(item.created_at.clone()),
        ),
    ]);
    let opt = |m: &mut HashMap<String, AttributeValue>, k: &str, v: &Option<String>| {
        if let Some(s) = v {
            m.insert(k.to_string(), AttributeValue::S(s.clone()));
        }
    };
    opt(&mut m, "actorDisplayName", &item.actor_display_name);
    opt(&mut m, "proposalId", &item.proposal_id);
    opt(&mut m, "commentId", &item.comment_id);
    opt(&mut m, "conversationId", &item.conversation_id);
    opt(&mut m, "messageId", &item.message_id);
    opt(&mut m, "documentName", &item.document_name);
    m
}

fn from_item(item: &HashMap<String, AttributeValue>) -> Result<InboxItem, AppError> {
    fn s<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Result<&'a str, AppError> {
        item.get(key)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
            .ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(format!(
                    "inbox item missing field: {key}"
                ))))
            })
    }
    fn opt(item: &HashMap<String, AttributeValue>, key: &str) -> Option<String> {
        item.get(key).and_then(|v| v.as_s().ok()).cloned()
    }
    Ok(InboxItem {
        id: s(item, "itemId")?.to_string(),
        kind: s(item, "kind")?.to_string(),
        project_id: s(item, "projectId")?.to_string(),
        project_slug: opt(item, "projectSlug").unwrap_or_default(),
        project_name: opt(item, "projectName").unwrap_or_default(),
        actor_id: s(item, "actorId")?.to_string(),
        actor_display_name: opt(item, "actorDisplayName"),
        proposal_id: opt(item, "proposalId"),
        comment_id: opt(item, "commentId"),
        conversation_id: opt(item, "conversationId"),
        message_id: opt(item, "messageId"),
        document_name: opt(item, "documentName"),
        preview: s(item, "preview")?.to_string(),
        created_at: s(item, "createdAt")?.to_string(),
        read_at: opt(item, "readAt"),
    })
}
