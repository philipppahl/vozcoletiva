//! Web Push subscriptions (decisions 0025, 0028, 0035).
//!
//! A subscription is keyed by its endpoint (`USER#<uid>/PUSHSUB#<endpoint>`), so
//! re-subscribing the same browser upserts. **Per-device notification prefs live
//! on the subscription item** (decision 0035) — each device decides which event
//! kinds push to it. A subscription existing = "push on" for that device; the
//! booleans gate which kinds. Prefs gate **push only** — inbox items are always
//! written.

use std::collections::HashMap;

use aws_sdk_dynamodb::types::AttributeValue;
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::state::AppState;

/// Per-device push preferences (decision 0035). One set per subscription.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPrefs {
    pub mention: bool,
    pub reply: bool,
    pub comment_on_yours: bool,
    pub proposal_closed: bool,
    pub document_amended: bool,
    /// Direct messages — not an inbox kind (DMs aren't fanned into the inbox),
    /// so it gates the realtime DM push directly (decision 0028).
    pub direct_message: bool,
}

impl Default for NotificationPrefs {
    /// A fresh device pushes everything until the user mutes a kind on it.
    fn default() -> Self {
        Self {
            mention: true,
            reply: true,
            comment_on_yours: true,
            proposal_closed: true,
            document_amended: true,
            direct_message: true,
        }
    }
}

impl NotificationPrefs {
    /// Whether the given event kind (inbox wire string, or `direct_message`)
    /// should push to a device with these prefs.
    pub fn allows(&self, kind: &str) -> bool {
        match kind {
            "mention" => self.mention,
            "reply" => self.reply,
            "comment-on-yours" => self.comment_on_yours,
            "proposal-closed" => self.proposal_closed,
            "document-amended" => self.document_amended,
            "direct_message" => self.direct_message,
            _ => false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct PushSubscription {
    pub endpoint: String,
    pub p256dh: String,
    pub auth: String,
    pub prefs: NotificationPrefs,
    pub created_at: String,
}

fn pref_items(prefs: &NotificationPrefs) -> [(&'static str, bool); 6] {
    [
        ("mention", prefs.mention),
        ("reply", prefs.reply),
        ("commentOnYours", prefs.comment_on_yours),
        ("proposalClosed", prefs.proposal_closed),
        ("documentAmended", prefs.document_amended),
        ("directMessage", prefs.direct_message),
    ]
}

fn prefs_from_item(item: &HashMap<String, AttributeValue>) -> NotificationPrefs {
    let b = |k: &str| {
        item.get(k)
            .and_then(|v| v.as_bool().ok())
            .copied()
            .unwrap_or(true) // pre-0035 subs (no pref attrs) default all-on
    };
    NotificationPrefs {
        mention: b("mention"),
        reply: b("reply"),
        comment_on_yours: b("commentOnYours"),
        proposal_closed: b("proposalClosed"),
        document_amended: b("documentAmended"),
        direct_message: b("directMessage"),
    }
}

/// A browser's push subscription as supplied on register. Grouped into a struct
/// so `add_subscription` stays within clippy's argument limit.
pub struct NewSubscription<'a> {
    pub endpoint: &'a str,
    pub p256dh: &'a str,
    pub auth: &'a str,
    pub user_agent: Option<&'a str>,
    pub prefs: &'a NotificationPrefs,
}

pub async fn add_subscription(
    state: &AppState,
    user_id: &str,
    sub: &NewSubscription<'_>,
    now: &str,
) -> Result<(), AppError> {
    let mut put = state
        .ddb
        .put_item()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(format!("USER#{user_id}")))
        .item("SK", AttributeValue::S(format!("PUSHSUB#{}", sub.endpoint)))
        .item("type", AttributeValue::S("PushSubscription".into()))
        .item("endpoint", AttributeValue::S(sub.endpoint.to_string()))
        .item("p256dh", AttributeValue::S(sub.p256dh.to_string()))
        .item("auth", AttributeValue::S(sub.auth.to_string()))
        .item("createdAt", AttributeValue::S(now.to_string()));
    for (k, v) in pref_items(sub.prefs) {
        put = put.item(k, AttributeValue::Bool(v));
    }
    if let Some(ua) = sub.user_agent {
        put = put.item("userAgent", AttributeValue::S(ua.to_string()));
    }
    put.send().await?;
    Ok(())
}

/// Update a device's per-kind prefs (decision 0035). Conditional on the
/// subscription existing — a stale/unregistered endpoint yields `NotFound`.
pub async fn update_subscription_prefs(
    state: &AppState,
    user_id: &str,
    endpoint: &str,
    prefs: &NotificationPrefs,
) -> Result<(), AppError> {
    let mut update = state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("USER#{user_id}")))
        .key("SK", AttributeValue::S(format!("PUSHSUB#{endpoint}")))
        .condition_expression("attribute_exists(SK)")
        .update_expression(
            "SET mention = :m, reply = :r, commentOnYours = :c, \
                 proposalClosed = :p, documentAmended = :d, directMessage = :dm",
        );
    let items = pref_items(prefs);
    let names = [":m", ":r", ":c", ":p", ":d", ":dm"];
    for ((_, v), n) in items.into_iter().zip(names) {
        update = update.expression_attribute_values(n, AttributeValue::Bool(v));
    }
    match update.send().await {
        Ok(_) => Ok(()),
        Err(err) => {
            let svc = err.into_service_error();
            if svc.is_conditional_check_failed_exception() {
                Err(AppError::NotFound)
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
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
        if let (Some(endpoint), Some(p256dh), Some(auth)) = (s("endpoint"), s("p256dh"), s("auth"))
        {
            out.push(PushSubscription {
                endpoint,
                p256dh,
                auth,
                prefs: prefs_from_item(&item),
                created_at: s("createdAt").unwrap_or_default(),
            });
        }
    }
    Ok(out)
}
