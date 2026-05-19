use std::collections::HashMap;

use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use serde::Serialize;
use ulid::Ulid;

use crate::auth::AuthenticatedUser;
use crate::domain::comment::Body;
use crate::error::AppError;
use crate::state::AppState;

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
}

impl Comment {
    pub fn is_deleted(&self) -> bool {
        self.deleted_at.is_some()
    }
}

pub async fn create(
    state: &AppState,
    proposal_id: &str,
    author: &AuthenticatedUser,
    author_display_name: &str,
    body: Body,
) -> Result<Comment, AppError> {
    let id = Ulid::new().to_string();
    let now = Utc::now();
    let body_str = body.into_inner();

    state
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
        .send()
        .await?;

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
    })
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
    })
}
