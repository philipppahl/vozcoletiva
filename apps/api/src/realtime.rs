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
use crate::push_send::PushContent;
use crate::repo::conversation::ConversationMeta;
use crate::repo::{conversation, membership};
use crate::state::AppState;

/// A new message extracted from a stream `NewImage` (`type == "Message"`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MessageEvent {
    pub conversation_id: String,
    pub message_id: String,
    pub author_id: String,
    pub author_display_name: String,
    pub body: String,
    pub parent_message_id: Option<String>,
}

/// A new inbox item extracted from a stream `NewImage` (`type == "InboxItem"`).
/// Used by the Web Push path (Phase 3).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InboxEvent {
    pub recipient_id: String,
    pub kind: String,
    pub actor_id: Option<String>,
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
                author_display_name: s(new_image, "authorDisplayName").unwrap_or_default(),
                body: s(new_image, "body").unwrap_or_default(),
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
                actor_id: s(new_image, "actorId"),
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

/// Who a new message reaches, resolved with one `get_meta`.
pub struct Targets {
    /// Everyone who gets a live WS broadcast: a channel's project members, or
    /// both DM participants. The author is included — their other devices want
    /// it, and the client dedups by message id.
    pub audience: Vec<String>,
    /// `Some([lo, hi])` for a DM (drives the DM push); `None` for a channel
    /// (channel notifications come from inbox items, not every message).
    pub dm_participants: Option<[String; 2]>,
}

pub async fn resolve_targets(state: &AppState, conversation_id: &str) -> Result<Targets, AppError> {
    match conversation::get_meta(state, conversation_id).await? {
        ConversationMeta::Channel(c) => Ok(Targets {
            audience: membership::list(state, &c.project_id)
                .await?
                .into_iter()
                .map(|m| m.user_id)
                .collect(),
            dm_participants: None,
        }),
        ConversationMeta::Dm(d) => Ok(Targets {
            audience: d.participant_ids.to_vec(),
            dm_participants: Some(d.participant_ids),
        }),
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

/// Trim a message/preview body for a notification line (no newlines, capped).
fn snippet(text: &str) -> String {
    const CAP: usize = 140;
    let one_line = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if one_line.chars().count() <= CAP {
        return one_line;
    }
    let mut s: String = one_line.chars().take(CAP - 1).collect();
    s.push('…');
    s
}

/// Resolve a user's avatar URL (their profile's key + the media base), or None.
pub async fn avatar_url(state: &AppState, user_id: &str) -> Option<String> {
    let media = state.media.as_ref()?;
    let profile = crate::repo::user::get_profile(state, user_id)
        .await
        .ok()??;
    profile.avatar_key.as_ref().map(|k| media.url_for(k))
}

/// Push copy for a DM message (the peer is notified). `icon` is the sender's
/// avatar. Server-side copy is EN for now (the body carries the content).
pub fn dm_push_content(ev: &MessageEvent, icon: Option<String>) -> PushContent {
    PushContent {
        title: if ev.author_display_name.is_empty() {
            "New message".to_string()
        } else {
            ev.author_display_name.clone()
        },
        body: snippet(&ev.body),
        url: format!("/dms/{}", ev.conversation_id),
        tag: Some(format!("dm-{}", ev.conversation_id)),
        icon,
    }
}

/// Push copy for an inbox item. `icon` is the actor's avatar. Deep-links to the
/// inbox; the item there carries its own in-app navigation.
pub fn inbox_push_content(ev: &InboxEvent, icon: Option<String>) -> PushContent {
    let who = ev.actor_display_name.as_deref().unwrap_or("Someone");
    let title = match ev.kind.as_str() {
        "mention" => format!("{who} mentioned you"),
        "reply" => format!("{who} replied"),
        "comment-on-yours" => format!("{who} commented on your proposal"),
        "proposal-closed" => format!("Decision closed in {}", ev.project_name),
        "document-amended" => format!("Document updated in {}", ev.project_name),
        _ => ev.project_name.clone(),
    };
    PushContent {
        title,
        body: snippet(&ev.preview),
        url: "/inbox".to_string(),
        tag: None,
        icon,
    }
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
            "authorDisplayName": attr_s("Tomás"),
            "body": attr_s("olá"),
        });
        assert_eq!(
            classify(&image),
            StreamEntity::Message(MessageEvent {
                conversation_id: "CONV1".into(),
                message_id: "M1".into(),
                author_id: "U1".into(),
                author_display_name: "Tomás".into(),
                body: "olá".into(),
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
            "authorDisplayName": attr_s("Marina"),
            "body": attr_s("+1"),
            "parentMessageId": attr_s("M1"),
        });
        let StreamEntity::Message(ev) = classify(&image) else {
            panic!("expected Message");
        };
        assert_eq!(ev.parent_message_id.as_deref(), Some("M1"));
    }

    fn msg(author: &str, name: &str, body: &str, conv: &str) -> MessageEvent {
        MessageEvent {
            conversation_id: conv.into(),
            message_id: "M".into(),
            author_id: author.into(),
            author_display_name: name.into(),
            body: body.into(),
            parent_message_id: None,
        }
    }

    #[test]
    fn dm_push_titles_with_sender_and_links_to_conversation() {
        let c = dm_push_content(
            &msg("U1", "Tomás Ferreira", "vamos?", "01ABC"),
            Some("https://cdn/avatars/u/1.webp".into()),
        );
        assert_eq!(c.title, "Tomás Ferreira");
        assert_eq!(c.body, "vamos?");
        assert_eq!(c.url, "/dms/01ABC");
        assert_eq!(c.tag.as_deref(), Some("dm-01ABC"));
        assert_eq!(c.icon.as_deref(), Some("https://cdn/avatars/u/1.webp"));
    }

    #[test]
    fn inbox_push_copy_per_kind() {
        let base = InboxEvent {
            recipient_id: "u".into(),
            kind: "mention".into(),
            actor_id: Some("a".into()),
            actor_display_name: Some("Marina".into()),
            project_name: "Vila".into(),
            preview: "@u olá".into(),
        };
        assert_eq!(
            inbox_push_content(&base, None).title,
            "Marina mentioned you"
        );
        assert_eq!(inbox_push_content(&base, None).url, "/inbox");
        let closed = InboxEvent {
            kind: "proposal-closed".into(),
            ..base.clone()
        };
        assert_eq!(
            inbox_push_content(&closed, None).title,
            "Decision closed in Vila"
        );
        // Missing actor falls back gracefully.
        let anon = InboxEvent {
            actor_display_name: None,
            ..base.clone()
        };
        assert_eq!(
            inbox_push_content(&anon, None).title,
            "Someone mentioned you"
        );
    }

    #[test]
    fn snippet_collapses_and_caps() {
        assert_eq!(snippet("  a\n\n b  "), "a b");
        let long = "x".repeat(200);
        assert!(snippet(&long).ends_with('…'));
        assert_eq!(snippet(&long).chars().count(), 140);
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
                actor_id: None,
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
            author_display_name: "U Name".into(),
            body: "hi".into(),
            parent_message_id: Some("P".into()),
        };
        let v: Value = serde_json::from_str(&message_signal(&ev)).unwrap();
        assert_eq!(v["type"], "message.created");
        assert_eq!(v["conversationId"], "C");
        assert_eq!(v["parentMessageId"], "P");
    }
}
