use std::collections::HashMap;

use aws_sdk_dynamodb::types::{AttributeValue, Put, TransactWriteItem};
use serde::Serialize;
use ulid::Ulid;

use crate::error::AppError;
use crate::state::AppState;

/// A channel conversation (project-scoped).
#[derive(Debug, Clone, Serialize)]
pub struct Conversation {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
}

/// A direct-message conversation between exactly two users. Not project-scoped.
#[derive(Debug, Clone, Serialize)]
pub struct DmConversation {
    pub id: String,
    /// Sorted `[lo, hi]` so the pair is order-independent.
    pub participant_ids: [String; 2],
    pub created_at: String,
}

/// A user's pointer to one of their DMs (`USER#<uid>/DM#<convId>`).
#[derive(Debug, Clone)]
pub struct DmPointer {
    pub conversation_id: String,
    pub peer_id: String,
    pub created_at: String,
}

/// The home record of a conversation, kind-aware. Channels require project
/// membership; DMs require being a participant. The shared message/read
/// endpoints branch on this.
pub enum ConversationMeta {
    Channel(Conversation),
    Dm(DmConversation),
}

impl ConversationMeta {
    pub fn id(&self) -> &str {
        match self {
            ConversationMeta::Channel(c) => &c.id,
            ConversationMeta::Dm(d) => &d.id,
        }
    }
}

/// Sorted pair `[lo, hi]` — the canonical, order-independent identity of a DM.
pub fn dm_pair(a: &str, b: &str) -> [String; 2] {
    if a <= b {
        [a.to_string(), b.to_string()]
    } else {
        [b.to_string(), a.to_string()]
    }
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

/// Load a conversation's home record, kind-aware. `type=Channel` → channel;
/// `type=DirectMessage` → DM.
pub async fn get_meta(state: &AppState, conversation_id: &str) -> Result<ConversationMeta, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("CONV#{conversation_id}")))
        .key("SK", AttributeValue::S("META".into()))
        .send()
        .await?;
    let item = r.item.ok_or(AppError::NotFound)?;
    let kind = item.get("type").and_then(|v| v.as_s().ok()).map(String::as_str);
    match kind {
        Some("DirectMessage") => Ok(ConversationMeta::Dm(dm_from_item(&item)?)),
        _ => Ok(ConversationMeta::Channel(conversation_from_item(&item)?)),
    }
}

/// Get the DM between two users, creating it if absent — idempotent per pair.
/// The pair sentinel (`DMPAIR#<lo>#<hi>`) guarantees one conversation per pair
/// even under a create race. Writes META + sentinel + a pointer for each user,
/// all in one transaction. `created_at` is RFC-3339.
pub async fn create_or_get_dm(
    state: &AppState,
    user_a: &str,
    user_b: &str,
    created_at: &str,
) -> Result<DmConversation, AppError> {
    let [lo, hi] = dm_pair(user_a, user_b);
    let sentinel_pk = format!("DMPAIR#{lo}#{hi}");

    if let Some(existing) = read_pair_sentinel(state, &sentinel_pk).await? {
        return Ok(existing);
    }

    let id = Ulid::new().to_string();
    let put = |item: HashMap<String, AttributeValue>, cond: Option<&str>| {
        let mut b = Put::builder().table_name(&state.table_name).set_item(Some(item));
        if let Some(c) = cond {
            b = b.condition_expression(c);
        }
        b.build().map_err(|e| AppError::Internal(Box::new(e)))
    };

    let meta = dm_meta_item(&id, &lo, &hi, created_at);
    let sentinel = dm_sentinel_item(&sentinel_pk, &id, created_at);
    let ptr_lo = dm_pointer_item(&lo, &id, &hi, created_at);
    let ptr_hi = dm_pointer_item(&hi, &id, &lo, created_at);

    let result = state
        .ddb
        .transact_write_items()
        .transact_items(TransactWriteItem::builder().put(put(meta, None)?).build())
        .transact_items(
            TransactWriteItem::builder()
                .put(put(sentinel, Some("attribute_not_exists(PK)"))?)
                .build(),
        )
        .transact_items(TransactWriteItem::builder().put(put(ptr_lo, None)?).build())
        .transact_items(TransactWriteItem::builder().put(put(ptr_hi, None)?).build())
        .send()
        .await;

    match result {
        Ok(_) => Ok(DmConversation {
            id,
            participant_ids: [lo, hi],
            created_at: created_at.to_string(),
        }),
        Err(err) => {
            // Lost a create race — the sentinel now exists; return the winner.
            let svc = err.into_service_error();
            if svc.to_string().contains("ConditionalCheckFailed") {
                read_pair_sentinel(state, &sentinel_pk)
                    .await?
                    .ok_or_else(|| AppError::Internal(Box::new(std::io::Error::other(
                        "DM pair conditional failed but sentinel not found",
                    ))))
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

async fn read_pair_sentinel(
    state: &AppState,
    sentinel_pk: &str,
) -> Result<Option<DmConversation>, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(sentinel_pk.to_string()))
        .key("SK", AttributeValue::S("CLAIMED".into()))
        .send()
        .await?;
    let Some(item) = r.item else {
        return Ok(None);
    };
    let conv_id = item
        .get("conversationId")
        .and_then(|v| v.as_s().ok())
        .cloned()
        .ok_or_else(|| AppError::Internal(Box::new(std::io::Error::other("sentinel missing conversationId"))))?;
    let created_at = item
        .get("createdAt")
        .and_then(|v| v.as_s().ok())
        .cloned()
        .unwrap_or_default();
    // The pair is encoded in the sentinel PK: DMPAIR#<lo>#<hi>.
    let parts: Vec<&str> = sentinel_pk.trim_start_matches("DMPAIR#").splitn(2, '#').collect();
    let (lo, hi) = (parts[0].to_string(), parts.get(1).copied().unwrap_or("").to_string());
    Ok(Some(DmConversation {
        id: conv_id,
        participant_ids: [lo, hi],
        created_at,
    }))
}

/// All of a user's DMs (newest pointers first not guaranteed; sorted by id).
pub async fn list_dms(state: &AppState, user_id: &str) -> Result<Vec<DmPointer>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{user_id}")))
        .expression_attribute_values(":sk", AttributeValue::S("DM#".into()))
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        out.push(dm_pointer_from_item(&item)?);
    }
    Ok(out)
}

fn dm_meta_item(id: &str, lo: &str, hi: &str, created_at: &str) -> HashMap<String, AttributeValue> {
    HashMap::from([
        ("PK".to_string(), AttributeValue::S(format!("CONV#{id}"))),
        ("SK".to_string(), AttributeValue::S("META".into())),
        ("type".to_string(), AttributeValue::S("DirectMessage".into())),
        ("conversationId".to_string(), AttributeValue::S(id.to_string())),
        (
            "participantIds".to_string(),
            AttributeValue::Ss(vec![lo.to_string(), hi.to_string()]),
        ),
        ("createdAt".to_string(), AttributeValue::S(created_at.to_string())),
    ])
}

fn dm_sentinel_item(pk: &str, conv_id: &str, created_at: &str) -> HashMap<String, AttributeValue> {
    HashMap::from([
        ("PK".to_string(), AttributeValue::S(pk.to_string())),
        ("SK".to_string(), AttributeValue::S("CLAIMED".into())),
        ("type".to_string(), AttributeValue::S("DmPair".into())),
        ("conversationId".to_string(), AttributeValue::S(conv_id.to_string())),
        ("createdAt".to_string(), AttributeValue::S(created_at.to_string())),
    ])
}

fn dm_pointer_item(
    user_id: &str,
    conv_id: &str,
    peer_id: &str,
    created_at: &str,
) -> HashMap<String, AttributeValue> {
    HashMap::from([
        ("PK".to_string(), AttributeValue::S(format!("USER#{user_id}"))),
        ("SK".to_string(), AttributeValue::S(format!("DM#{conv_id}"))),
        ("type".to_string(), AttributeValue::S("DmPointer".into())),
        ("conversationId".to_string(), AttributeValue::S(conv_id.to_string())),
        ("peerId".to_string(), AttributeValue::S(peer_id.to_string())),
        ("createdAt".to_string(), AttributeValue::S(created_at.to_string())),
    ])
}

fn dm_from_item(item: &HashMap<String, AttributeValue>) -> Result<DmConversation, AppError> {
    let id = item
        .get("conversationId")
        .and_then(|v| v.as_s().ok())
        .cloned()
        .ok_or_else(|| AppError::Internal(Box::new(std::io::Error::other("dm missing conversationId"))))?;
    let mut parts: Vec<String> = item
        .get("participantIds")
        .and_then(|v| v.as_ss().ok())
        .cloned()
        .unwrap_or_default();
    parts.sort();
    if parts.len() != 2 {
        return Err(AppError::Internal(Box::new(std::io::Error::other(
            "dm must have exactly two participants",
        ))));
    }
    let created_at = item
        .get("createdAt")
        .and_then(|v| v.as_s().ok())
        .cloned()
        .unwrap_or_default();
    Ok(DmConversation {
        id,
        participant_ids: [parts[0].clone(), parts[1].clone()],
        created_at,
    })
}

fn dm_pointer_from_item(item: &HashMap<String, AttributeValue>) -> Result<DmPointer, AppError> {
    fn s<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Result<&'a str, AppError> {
        item.get(key)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
            .ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(format!(
                    "dm pointer missing field: {key}"
                ))))
            })
    }
    Ok(DmPointer {
        conversation_id: s(item, "conversationId")?.to_string(),
        peer_id: s(item, "peerId")?.to_string(),
        created_at: s(item, "createdAt")?.to_string(),
    })
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
