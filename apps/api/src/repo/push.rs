//! Web Push subscriptions + notification preferences (decision 0025).
//!
//! A subscription is keyed by its endpoint (`USER#<uid>/PUSHSUB#<endpoint>`), so
//! re-subscribing the same browser upserts. Preferences live in one settings
//! item (`USER#<uid>/NOTIFPREF/SETTINGS`) and gate **push only** — inbox items
//! are always written.

use std::collections::HashMap;

use aws_sdk_dynamodb::types::AttributeValue;
use serde::Serialize;

use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone)]
pub struct PushSubscription {
    pub endpoint: String,
    pub p256dh: String,
    pub auth: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NotificationPrefs {
    pub push_enabled: bool,
    pub mention: bool,
    pub reply: bool,
    pub comment_on_yours: bool,
    pub proposal_closed: bool,
    pub document_amended: bool,
}

impl Default for NotificationPrefs {
    /// Once a user opts into push, everything pushes until they toggle a kind off.
    fn default() -> Self {
        Self {
            push_enabled: true,
            mention: true,
            reply: true,
            comment_on_yours: true,
            proposal_closed: true,
            document_amended: true,
        }
    }
}

impl NotificationPrefs {
    /// Whether the given inbox kind (wire string) should push, honouring the
    /// master switch.
    pub fn allows(&self, kind: &str) -> bool {
        self.push_enabled
            && match kind {
                "mention" => self.mention,
                "reply" => self.reply,
                "comment-on-yours" => self.comment_on_yours,
                "proposal-closed" => self.proposal_closed,
                "document-amended" => self.document_amended,
                _ => false,
            }
    }
}

const SETTINGS_SK: &str = "NOTIFPREF/SETTINGS";

pub async fn add_subscription(
    state: &AppState,
    user_id: &str,
    endpoint: &str,
    p256dh: &str,
    auth: &str,
    user_agent: Option<&str>,
    now: &str,
) -> Result<(), AppError> {
    let mut put = state
        .ddb
        .put_item()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(format!("USER#{user_id}")))
        .item("SK", AttributeValue::S(format!("PUSHSUB#{endpoint}")))
        .item("type", AttributeValue::S("PushSubscription".into()))
        .item("endpoint", AttributeValue::S(endpoint.to_string()))
        .item("p256dh", AttributeValue::S(p256dh.to_string()))
        .item("auth", AttributeValue::S(auth.to_string()))
        .item("createdAt", AttributeValue::S(now.to_string()));
    if let Some(ua) = user_agent {
        put = put.item("userAgent", AttributeValue::S(ua.to_string()));
    }
    put.send().await?;
    Ok(())
}

pub async fn delete_subscription(
    state: &AppState,
    user_id: &str,
    endpoint: &str,
) -> Result<(), AppError> {
    state
        .ddb
        .delete_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("USER#{user_id}")))
        .key("SK", AttributeValue::S(format!("PUSHSUB#{endpoint}")))
        .send()
        .await?;
    Ok(())
}

pub async fn list_subscriptions(
    state: &AppState,
    user_id: &str,
) -> Result<Vec<PushSubscription>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{user_id}")))
        .expression_attribute_values(":sk", AttributeValue::S("PUSHSUB#".into()))
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        let s = |k: &str| item.get(k).and_then(|v| v.as_s().ok()).cloned();
        if let (Some(endpoint), Some(p256dh), Some(auth)) = (s("endpoint"), s("p256dh"), s("auth")) {
            out.push(PushSubscription {
                endpoint,
                p256dh,
                auth,
            });
        }
    }
    Ok(out)
}

pub async fn get_prefs(state: &AppState, user_id: &str) -> Result<NotificationPrefs, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("USER#{user_id}")))
        .key("SK", AttributeValue::S(SETTINGS_SK.into()))
        .send()
        .await?;
    match r.item {
        None => Ok(NotificationPrefs::default()),
        Some(item) => Ok(prefs_from_item(&item)),
    }
}

pub async fn put_prefs(
    state: &AppState,
    user_id: &str,
    prefs: &NotificationPrefs,
) -> Result<(), AppError> {
    let b = |v: bool| AttributeValue::Bool(v);
    state
        .ddb
        .put_item()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(format!("USER#{user_id}")))
        .item("SK", AttributeValue::S(SETTINGS_SK.into()))
        .item("type", AttributeValue::S("NotificationPrefs".into()))
        .item("pushEnabled", b(prefs.push_enabled))
        .item("mention", b(prefs.mention))
        .item("reply", b(prefs.reply))
        .item("commentOnYours", b(prefs.comment_on_yours))
        .item("proposalClosed", b(prefs.proposal_closed))
        .item("documentAmended", b(prefs.document_amended))
        .send()
        .await?;
    Ok(())
}

fn prefs_from_item(item: &HashMap<String, AttributeValue>) -> NotificationPrefs {
    let b = |k: &str, default: bool| {
        item.get(k)
            .and_then(|v| v.as_bool().ok())
            .copied()
            .unwrap_or(default)
    };
    NotificationPrefs {
        push_enabled: b("pushEnabled", true),
        mention: b("mention", true),
        reply: b("reply", true),
        comment_on_yours: b("commentOnYours", true),
        proposal_closed: b("proposalClosed", true),
        document_amended: b("documentAmended", true),
    }
}
