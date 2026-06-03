use std::collections::{HashMap, HashSet};

use aws_sdk_dynamodb::types::{AttributeValue, Delete, Put, TransactWriteItem, Update};
use chrono::{DateTime, Utc};
use serde::Serialize;
use ulid::Ulid;

use crate::auth::AuthenticatedUser;
use crate::domain::comment::Body;
use crate::error::AppError;
use crate::state::AppState;

/// Immutable snapshot of the comment a reply quotes — captured at write time so
/// the quote header survives the original being edited/deleted. Comments are
/// text-only, so (unlike chat) there's no media `kind`. (decision 0033)
#[derive(Debug, Clone, Serialize)]
pub struct CommentReplyTo {
    pub id: String,
    pub author_id: String,
    pub author_display_name: String,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Comment {
    pub id: String,
    pub proposal_id: String,
    pub author_id: String,
    pub author_display_name: String,
    pub body: Option<String>,
    pub created_at: DateTime<Utc>,
    pub edited_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<String>,
    /// The quoted comment, when this is a reply (decision 0033).
    pub reply_to: Option<CommentReplyTo>,
    /// Materialised reaction tallies (emoji → count), bumped transactionally as
    /// people react. The viewer's own reactions ("me") come from a separate
    /// lookup, not this map.
    pub reaction_counts: HashMap<String, i64>,
}

impl Comment {
    pub fn is_deleted(&self) -> bool {
        self.deleted_at.is_some()
    }
}

/// A short preview snapshot for a reply quote header — the parent comment's
/// body, single-lined + truncated.
pub fn preview_of(comment: &Comment) -> String {
    let raw = comment.body.as_deref().unwrap_or("");
    let flat: String = raw.split_whitespace().collect::<Vec<_>>().join(" ");
    if flat.chars().count() > 120 {
        format!("{}…", flat.chars().take(119).collect::<String>())
    } else {
        flat
    }
}

pub async fn create(
    state: &AppState,
    proposal_id: &str,
    author: &AuthenticatedUser,
    author_display_name: &str,
    body: Body,
    reply_to: Option<CommentReplyTo>,
) -> Result<Comment, AppError> {
    let id = Ulid::new().to_string();
    let now = Utc::now();
    let body_str = body.into_inner();

    let mut put = state
        .ddb
        .put_item()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(format!("PROPOSAL#{proposal_id}")))
        .item(
            "SK",
            AttributeValue::S(format!("COMMENT#{}#{id}", now.to_rfc3339())),
        )
        .item("type", AttributeValue::S("Comment".into()))
        .item("commentId", AttributeValue::S(id.clone()))
        .item("proposalId", AttributeValue::S(proposal_id.into()))
        .item("authorId", AttributeValue::S(author.user_id.clone()))
        .item(
            "authorDisplayName",
            AttributeValue::S(author_display_name.into()),
        )
        .item("body", AttributeValue::S(body_str.clone()))
        .item("createdAt", AttributeValue::S(now.to_rfc3339()))
        // Born with an empty count map so reaction ADDs never hit a missing attr.
        .item("reactionCounts", AttributeValue::M(HashMap::new()));

    if let Some(rt) = &reply_to {
        put = put
            .item("replyToId", AttributeValue::S(rt.id.clone()))
            .item("replyToAuthorId", AttributeValue::S(rt.author_id.clone()))
            .item(
                "replyToAuthorDisplayName",
                AttributeValue::S(rt.author_display_name.clone()),
            )
            .item("replyToPreview", AttributeValue::S(rt.preview.clone()));
    }
    put.send().await?;

    Ok(Comment {
        id,
        proposal_id: proposal_id.into(),
        author_id: author.user_id.clone(),
        author_display_name: author_display_name.into(),
        body: Some(body_str),
        created_at: now,
        edited_at: None,
        deleted_at: None,
        deleted_by: None,
        reply_to,
        reaction_counts: HashMap::new(),
    })
}

fn creact_sk(user_id: &str, comment_id: &str, emoji: &str) -> String {
    format!("CREACT#{user_id}#{comment_id}#{emoji}")
}

/// Add (`active`) or remove the caller's reaction on a comment. Mirrors the
/// message reaction path (decision 0031): the reaction item + the materialised
/// count move together in one transaction, and it's idempotent. (decision 0033)
pub async fn set_reaction(
    state: &AppState,
    proposal_id: &str,
    comment_id: &str,
    user_id: &str,
    emoji: &str,
    active: bool,
) -> Result<(), AppError> {
    // Need the comment's full SK (it embeds createdAt) to bump its counts.
    let existing = get(state, proposal_id, comment_id).await?;
    if existing.deleted_at.is_some() {
        return Err(AppError::Conflict("comment was deleted".into()));
    }
    let pk = format!("PROPOSAL#{proposal_id}");
    let comment_sk = format!("COMMENT#{}#{}", existing.created_at.to_rfc3339(), comment_id);
    let react_sk = creact_sk(user_id, comment_id, emoji);
    let now = Utc::now().to_rfc3339();

    // Ensure the count map exists for comments created before reactions shipped.
    state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(pk.clone()))
        .key("SK", AttributeValue::S(comment_sk.clone()))
        .update_expression("SET reactionCounts = if_not_exists(reactionCounts, :empty)")
        .expression_attribute_values(":empty", AttributeValue::M(HashMap::new()))
        .condition_expression("attribute_exists(SK)")
        .send()
        .await
        .map_err(|e| AppError::Internal(Box::new(e.into_service_error())))?;

    let count_delta = if active { "1" } else { "-1" };
    let bump = Update::builder()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(pk.clone()))
        .key("SK", AttributeValue::S(comment_sk))
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
                    .item("SK", AttributeValue::S(react_sk))
                    .item("type", AttributeValue::S("CommentReaction".into()))
                    .item("userId", AttributeValue::S(user_id.to_string()))
                    .item("commentId", AttributeValue::S(comment_id.to_string()))
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
                    .key("SK", AttributeValue::S(react_sk))
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
            // Reaction item's condition failed → already in the desired state.
            if svc.to_string().contains("ConditionalCheckFailed") {
                Ok(())
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

/// The caller's comment reactions in a proposal, as a set of
/// `"<commentId>#<emoji>"`. Strongly consistent so a toggle's response reflects
/// the just-written reaction.
pub async fn user_reactions(
    state: &AppState,
    proposal_id: &str,
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
                AttributeValue::S(format!("PROPOSAL#{proposal_id}")),
            )
            .expression_attribute_values(":pre", AttributeValue::S(format!("CREACT#{user_id}#")))
            .consistent_read(true)
            .set_exclusive_start_key(start)
            .send()
            .await?;
        for item in q.items.unwrap_or_default() {
            if let (Some(cid), Some(e)) = (
                item.get("commentId").and_then(|v| v.as_s().ok()),
                item.get("emoji").and_then(|v| v.as_s().ok()),
            ) {
                out.insert(format!("{cid}#{e}"));
            }
        }
        start = q.last_evaluated_key;
        if start.is_none() {
            break;
        }
    }
    Ok(out)
}

pub async fn list_for_proposal(
    state: &AppState,
    proposal_id: &str,
) -> Result<Vec<Comment>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .expression_attribute_values(
            ":pk",
            AttributeValue::S(format!("PROPOSAL#{proposal_id}")),
        )
        .expression_attribute_values(":sk", AttributeValue::S("COMMENT#".into()))
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        out.push(comment_from_item(&item)?);
    }
    Ok(out)
}

/// Locate a comment by id. Requires the proposal_id (the partition); we can't
/// efficiently look up a comment by id alone without a new GSI, and we always
/// have the proposal id in the route.
pub async fn get(
    state: &AppState,
    proposal_id: &str,
    comment_id: &str,
) -> Result<Comment, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .filter_expression("commentId = :id")
        .expression_attribute_values(
            ":pk",
            AttributeValue::S(format!("PROPOSAL#{proposal_id}")),
        )
        .expression_attribute_values(":sk", AttributeValue::S("COMMENT#".into()))
        .expression_attribute_values(":id", AttributeValue::S(comment_id.into()))
        // Strongly consistent: edit/delete/reaction toggle all re-read here and
        // need the just-written state.
        .consistent_read(true)
        .send()
        .await?;
    q.items
        .and_then(|mut v| v.pop())
        .ok_or(AppError::NotFound)
        .and_then(|item| comment_from_item(&item))
}

/// Update the body of an existing comment. Conditional on:
///   * the caller being the author
///   * the comment not already being deleted
pub async fn update_body(
    state: &AppState,
    proposal_id: &str,
    comment_id: &str,
    author: &AuthenticatedUser,
    new_body: Body,
) -> Result<Comment, AppError> {
    // We need the comment's SK (which includes its createdAt) to update it.
    // Get it first.
    let existing = get(state, proposal_id, comment_id).await?;
    if existing.author_id != author.user_id {
        return Err(AppError::Forbidden(
            "only the comment author can edit it".into(),
        ));
    }
    if existing.deleted_at.is_some() {
        return Err(AppError::Conflict("comment was deleted".into()));
    }

    let sk = format!("COMMENT#{}#{}", existing.created_at.to_rfc3339(), comment_id);
    let now = Utc::now();
    let body_str = new_body.into_inner();

    let result = state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("PROPOSAL#{proposal_id}")))
        .key("SK", AttributeValue::S(sk))
        .update_expression("SET body = :b, editedAt = :ts")
        .expression_attribute_values(":b", AttributeValue::S(body_str.clone()))
        .expression_attribute_values(":ts", AttributeValue::S(now.to_rfc3339()))
        .expression_attribute_values(":author", AttributeValue::S(author.user_id.clone()))
        .condition_expression("authorId = :author AND attribute_not_exists(deletedAt)")
        .send()
        .await;
    match result {
        Ok(_) => Ok(Comment {
            body: Some(body_str),
            edited_at: Some(now),
            ..existing
        }),
        Err(err) => {
            let svc = err.into_service_error();
            if svc.is_conditional_check_failed_exception() {
                Err(AppError::Conflict(
                    "comment changed under you; refresh and try again".into(),
                ))
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

/// Soft-delete a comment. Idempotent: if already deleted, returns the existing
/// record unchanged.
pub async fn soft_delete(
    state: &AppState,
    proposal_id: &str,
    comment_id: &str,
    actor: &AuthenticatedUser,
    actor_is_admin: bool,
) -> Result<Comment, AppError> {
    let existing = get(state, proposal_id, comment_id).await?;
    if existing.deleted_at.is_some() {
        return Ok(existing);
    }
    if !(actor_is_admin || existing.author_id == actor.user_id) {
        return Err(AppError::Forbidden(
            "only the author or an admin can delete a comment".into(),
        ));
    }

    let sk = format!("COMMENT#{}#{}", existing.created_at.to_rfc3339(), comment_id);
    let now = Utc::now();
    let result = state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("PROPOSAL#{proposal_id}")))
        .key("SK", AttributeValue::S(sk))
        .update_expression("SET deletedAt = :ts, deletedBy = :by, body = :empty")
        .expression_attribute_values(":ts", AttributeValue::S(now.to_rfc3339()))
        .expression_attribute_values(":by", AttributeValue::S(actor.user_id.clone()))
        .expression_attribute_values(":empty", AttributeValue::S(String::new()))
        .condition_expression("attribute_not_exists(deletedAt)")
        .send()
        .await;
    match result {
        Ok(_) => Ok(Comment {
            body: None,
            deleted_at: Some(now),
            deleted_by: Some(actor.user_id.clone()),
            ..existing
        }),
        Err(err) => {
            let svc = err.into_service_error();
            if svc.is_conditional_check_failed_exception() {
                // Race: another deleter beat us; read back and return.
                let refreshed = get(state, proposal_id, comment_id).await?;
                Ok(refreshed)
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

fn comment_from_item(item: &HashMap<String, AttributeValue>) -> Result<Comment, AppError> {
    fn s<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Result<&'a str, AppError> {
        item.get(key)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
            .ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(format!(
                    "comment missing field: {key}"
                ))))
            })
    }
    fn s_opt<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Option<&'a str> {
        item.get(key).and_then(|v| v.as_s().ok()).map(String::as_str)
    }

    let created_at = chrono::DateTime::parse_from_rfc3339(s(item, "createdAt")?)
        .map_err(|e| AppError::Internal(Box::new(e)))?
        .with_timezone(&Utc);
    let edited_at = s_opt(item, "editedAt")
        .map(|s| {
            chrono::DateTime::parse_from_rfc3339(s)
                .map(|d| d.with_timezone(&Utc))
                .map_err(|e| AppError::Internal(Box::new(e)))
        })
        .transpose()?;
    let deleted_at = s_opt(item, "deletedAt")
        .map(|s| {
            chrono::DateTime::parse_from_rfc3339(s)
                .map(|d| d.with_timezone(&Utc))
                .map_err(|e| AppError::Internal(Box::new(e)))
        })
        .transpose()?;

    let body = if deleted_at.is_some() {
        None
    } else {
        Some(s(item, "body")?.to_string())
    };

    let reply_to = s_opt(item, "replyToId").map(|id| CommentReplyTo {
        id: id.to_string(),
        author_id: s_opt(item, "replyToAuthorId").unwrap_or_default().to_string(),
        author_display_name: s_opt(item, "replyToAuthorDisplayName")
            .unwrap_or_default()
            .to_string(),
        preview: s_opt(item, "replyToPreview").unwrap_or_default().to_string(),
    });

    let reaction_counts = item
        .get("reactionCounts")
        .and_then(|v| v.as_m().ok())
        .map(|m| {
            m.iter()
                .filter_map(|(k, v)| {
                    v.as_n().ok().and_then(|n| n.parse::<i64>().ok()).map(|c| (k.clone(), c))
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(Comment {
        id: s(item, "commentId")?.to_string(),
        proposal_id: s(item, "proposalId")?.to_string(),
        author_id: s(item, "authorId")?.to_string(),
        author_display_name: s(item, "authorDisplayName")?.to_string(),
        body,
        created_at,
        edited_at,
        deleted_at,
        deleted_by: s_opt(item, "deletedBy").map(String::from),
        reply_to,
        reaction_counts,
    })
}
