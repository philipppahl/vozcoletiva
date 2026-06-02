//! Shared logic for the realtime stream consumer (`voz-realtime`): parse the
//! DynamoDB-stream `NewImage` into the entities we deliver, and resolve a
//! conversation's broadcast audience.
//!
//! The broadcast payload is deliberately a thin *signal*, not the message DTO:
//! `{ "type": "message.created", "conversationId", "parentMessageId" }`. The
//! client invalidates the affected queries and refetches through the same REST
//! endpoints it already uses — so the WS surface carries no DTO coupling and
//! the optimistic-merge dedup (decision 0027) handles reconciliation. This
//! mirrors the mock `useMessageBusBridge` the FE already ships.

use serde_json::Value;

use crate::error::AppError;
use crate::repo::conversation::ConversationMeta;
use crate::repo::{conversation, membership};
use crate::state::AppState;

/// A new message extracted from a stream `NewImage` (`type == "Message"`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageEvent {
    pub conversation_id: String,
    pub message_id: String,
    pub author_id: String,
    pub parent_message_id: Option<String>,
}

/// A new inbox item extracted from a stream `NewImage` (`type == "InboxItem"`).
/// Used by the Web Push path (Phase 3).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InboxEvent {
    pub recipient_id: String,
    pub kind: String,
    pub actor_display_name: Option<String>,
    pub project_name: String,
    pub preview: String,
}

/// What a stream `NewImage` represents, as far as realtime delivery cares.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StreamEntity {
    Message(MessageEvent),
    Inbox(InboxEvent),
    /// Anything else (connections, votes, projects, …) — ignored.
    Other,
}

/// Read a DynamoDB-stream string attribute: `image[key] == { "S": "<value>" }`.
fn s(image: &Value, key: &str) -> Option<String> {
    image
        .get(key)
        .and_then(|v| v.get("S"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
}

/// Classify a stream `NewImage` by its `type` attribute and pull the fields the
/// realtime consumer needs. Returns `Other` for anything we don't deliver.
pub fn classify(new_image: &Value) -> StreamEntity {
    match s(new_image, "type").as_deref() {
        Some("Message") => {
            let (Some(conversation_id), Some(message_id), Some(author_id)) = (
                s(new_image, "conversationId"),
                s(new_image, "messageId"),
                s(new_image, "authorId"),
            ) else {
                return StreamEntity::Other;
            };
            StreamEntity::Message(MessageEvent {
                conversation_id,
                message_id,
                author_id,
                parent_message_id: s(new_image, "parentMessageId"),
            })
        }
        Some("InboxItem") => {
            let (Some(recipient), Some(kind)) =
                (recipient_from_pk(new_image), s(new_image, "kind"))
            else {
                return StreamEntity::Other;
            };
            StreamEntity::Inbox(InboxEvent {
                recipient_id: recipient,
                kind,
                actor_display_name: s(new_image, "actorDisplayName"),
                project_name: s(new_image, "projectName").unwrap_or_default(),
                preview: s(new_image, "preview").unwrap_or_default(),
            })
        }
        _ => StreamEntity::Other,
    }
}

/// Inbox items are keyed `USER#<recipient>` / `INBOX#<id>`; the recipient is the
/// PK suffix.
fn recipient_from_pk(image: &Value) -> Option<String> {
    s(image, "PK").and_then(|pk| pk.strip_prefix("USER#").map(str::to_string))
}

/// The set of users that should receive a live broadcast of a message: every
/// member of a channel's project, or both participants of a DM. The author is
/// included — their other devices want it, and the client dedups by message id.
pub async fn broadcast_audience(
    state: &AppState,
    conversation_id: &str,
) -> Result<Vec<String>, AppError> {
    match conversation::get_meta(state, conversation_id).await? {
        ConversationMeta::Channel(c) => Ok(membership::list(state, &c.project_id)
            .await?
            .into_iter()
            .map(|m| m.user_id)
            .collect()),
        ConversationMeta::Dm(d) => Ok(d.participant_ids.to_vec()),
    }
}

/// The thin signal pushed to a connected client for a new message.
pub fn message_signal(ev: &MessageEvent) -> String {
    serde_json::json!({
        "type": "message.created",
        "conversationId": ev.conversation_id,
        "parentMessageId": ev.parent_message_id,
    })
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn attr_s(v: &str) -> Value {
        json!({ "S": v })
    }

    #[test]
    fn classifies_top_level_message() {
        let image = json!({
            "type": attr_s("Message"),
            "conversationId": attr_s("CONV1"),
            "messageId": attr_s("M1"),
            "authorId": attr_s("U1"),
        });
        assert_eq!(
            classify(&image),
            StreamEntity::Message(MessageEvent {
                conversation_id: "CONV1".into(),
                message_id: "M1".into(),
                author_id: "U1".into(),
                parent_message_id: None,
            })
        );
    }

    #[test]
    fn classifies_reply_with_parent() {
        let image = json!({
            "type": attr_s("Message"),
            "conversationId": attr_s("CONV1"),
            "messageId": attr_s("M2"),
            "authorId": attr_s("U2"),
            "parentMessageId": attr_s("M1"),
        });
        let StreamEntity::Message(ev) = classify(&image) else {
            panic!("expected Message");
        };
        assert_eq!(ev.parent_message_id.as_deref(), Some("M1"));
    }

    #[test]
    fn classifies_inbox_item_recipient_from_pk() {
        let image = json!({
            "type": attr_s("InboxItem"),
            "PK": attr_s("USER#alice"),
            "kind": attr_s("mention"),
            "preview": attr_s("hi @alice"),
            "projectName": attr_s("Vila"),
        });
        assert_eq!(
            classify(&image),
            StreamEntity::Inbox(InboxEvent {
                recipient_id: "alice".into(),
                kind: "mention".into(),
                actor_display_name: None,
                project_name: "Vila".into(),
                preview: "hi @alice".into(),
            })
        );
    }

    #[test]
    fn ignores_other_types_and_malformed() {
        assert_eq!(
            classify(&json!({ "type": attr_s("Vote") })),
            StreamEntity::Other
        );
        // Message missing required keys → Other, not a panic.
        assert_eq!(
            classify(&json!({ "type": attr_s("Message"), "conversationId": attr_s("C") })),
            StreamEntity::Other
        );
    }

    #[test]
    fn signal_is_thin_and_carries_parent() {
        let ev = MessageEvent {
            conversation_id: "C".into(),
            message_id: "M".into(),
            author_id: "U".into(),
            parent_message_id: Some("P".into()),
        };
        let v: Value = serde_json::from_str(&message_signal(&ev)).unwrap();
        assert_eq!(v["type"], "message.created");
        assert_eq!(v["conversationId"], "C");
        assert_eq!(v["parentMessageId"], "P");
    }
}
