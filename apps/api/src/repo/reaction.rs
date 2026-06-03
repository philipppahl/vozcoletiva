//! Message reactions (decision 0031). A reaction is one item
//! `CONV#<conv> / REACT#<userId>#<msgId>#<emoji>` — outside the `MSG#` range so
//! it never pollutes the timeline query. The message item carries the
//! materialised per-emoji counts; the viewer's own reactions ("me") come from a
//! small `begins_with(REACT#<user>#)` query. Toggling moves the reaction item +
//! the count together in one transaction, and is idempotent.

use std::collections::HashSet;

use aws_sdk_dynamodb::types::{AttributeValue, Delete, Put, TransactWriteItem, Update};
use chrono::Utc;

use crate::error::AppError;
use crate::state::AppState;

fn react_sk(user_id: &str, message_id: &str, emoji: &str) -> String {
    format!("REACT#{user_id}#{message_id}#{emoji}")
}

/// Add (`active`) or remove the caller's reaction. A no-op when already in the
/// desired state (the conditional reaction item fails → count untouched).
pub async fn set_reaction(
    state: &AppState,
    conversation_id: &str,
    message_id: &str,
    user_id: &str,
    emoji: &str,
    active: bool,
) -> Result<(), AppError> {
    let pk = format!("CONV#{conversation_id}");
    let sk = react_sk(user_id, message_id, emoji);
    let msg_sk = format!("MSG#{message_id}");
    let now = Utc::now().to_rfc3339();

    // Ensure the message's count map exists before the nested `ADD` — messages
    // created before reactions shipped don't have it. Idempotent; no-op when
    // present. (New messages are born with an empty map.)
    state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(pk.clone()))
        .key("SK", AttributeValue::S(msg_sk.clone()))
        .update_expression("SET reactionCounts = if_not_exists(reactionCounts, :empty)")
        .expression_attribute_values(
            ":empty",
            AttributeValue::M(std::collections::HashMap::new()),
        )
        .condition_expression("attribute_exists(SK)")
        .send()
        .await
        .map_err(|e| AppError::Internal(Box::new(e.into_service_error())))?;

    let count_delta = if active { "1" } else { "-1" };
    let bump = Update::builder()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(pk.clone()))
        .key("SK", AttributeValue::S(msg_sk))
        .update_expression("ADD reactionCounts.#e :d")
        .expression_attribute_names("#e", emoji)
        .expression_attribute_values(":d", AttributeValue::N(count_delta.into()))
        .condition_expression("attribute_exists(SK)")
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    let react_item = if active {
        TransactWriteItem::builder()
            .put(
                Put::builder()
                    .table_name(&state.table_name)
                    .item("PK", AttributeValue::S(pk.clone()))
                    .item("SK", AttributeValue::S(sk))
                    .item("type", AttributeValue::S("Reaction".into()))
                    .item("userId", AttributeValue::S(user_id.to_string()))
                    .item("messageId", AttributeValue::S(message_id.to_string()))
                    .item("emoji", AttributeValue::S(emoji.to_string()))
                    .item("createdAt", AttributeValue::S(now))
                    .condition_expression("attribute_not_exists(SK)")
                    .build()
                    .map_err(|e| AppError::Internal(Box::new(e)))?,
            )
            .build()
    } else {
        TransactWriteItem::builder()
            .delete(
                Delete::builder()
                    .table_name(&state.table_name)
                    .key("PK", AttributeValue::S(pk.clone()))
                    .key("SK", AttributeValue::S(sk))
                    .condition_expression("attribute_exists(SK)")
                    .build()
                    .map_err(|e| AppError::Internal(Box::new(e)))?,
            )
            .build()
    };

    let res = state
        .ddb
        .transact_write_items()
        .transact_items(react_item)
        .transact_items(TransactWriteItem::builder().update(bump).build())
        .send()
        .await;
    match res {
        Ok(_) => Ok(()),
        Err(err) => {
            let svc = err.into_service_error();
            // The reaction item's condition failed → already in the desired
            // state. Idempotent: succeed without touching the count.
            if svc.to_string().contains("ConditionalCheckFailed") {
                Ok(())
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

/// The caller's reactions in a conversation, as a set of `"<msgId>#<emoji>"`.
pub async fn user_reactions(
    state: &AppState,
    conversation_id: &str,
    user_id: &str,
) -> Result<HashSet<String>, AppError> {
    let mut out = HashSet::new();
    let mut start = None;
    loop {
        let q = state
            .ddb
            .query()
            .table_name(&state.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :pre)")
            .expression_attribute_values(
                ":pk",
                AttributeValue::S(format!("CONV#{conversation_id}")),
            )
            .expression_attribute_values(
                ":pre",
                AttributeValue::S(format!("REACT#{user_id}#")),
            )
            .set_exclusive_start_key(start)
            .send()
            .await?;
        for item in q.items.unwrap_or_default() {
            if let (Some(mid), Some(e)) = (
                item.get("messageId").and_then(|v| v.as_s().ok()),
                item.get("emoji").and_then(|v| v.as_s().ok()),
            ) {
                out.insert(format!("{mid}#{e}"));
            }
        }
        start = q.last_evaluated_key;
        if start.is_none() {
            break;
        }
    }
    Ok(out)
}
