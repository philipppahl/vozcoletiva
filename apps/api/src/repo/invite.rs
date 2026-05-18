use std::collections::HashMap;

use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Duration, Utc};
use rand::Rng;
use serde::Serialize;
use ulid::Ulid;

use crate::auth::AuthenticatedUser;
use crate::domain::{code, role::Role};
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct Invite {
    pub id: String,
    pub project_id: String,
    pub token: String,
    pub code: String,
    pub role: Role,
    pub max_uses: Option<i64>,
    pub use_count: i64,
    pub expires_at: Option<DateTime<Utc>>,
    pub note: Option<String>,
    pub issued_by: String,
    pub issued_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

/// Create an invite. Defaults: role = Member, no expiry, max_uses = None
/// (unlimited). The token is a 32-byte url-safe random string.
pub async fn create(
    state: &AppState,
    issuer: &AuthenticatedUser,
    project_id: &str,
    role: Role,
    expires_in: Option<Duration>,
    max_uses: Option<i64>,
    note: Option<String>,
) -> Result<Invite, AppError> {
    if !Role::invitable().contains(&role) {
        return Err(AppError::BadRequest(format!(
            "invites cannot grant role '{role}'"
        )));
    }
    let id = Ulid::new().to_string();
    let token = random_token();
    let short_code = code::generate();
    let now = Utc::now();
    let expires_at = expires_in.map(|d| now + d);

    let mut put = state
        .ddb
        .put_item()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(format!("PROJECT#{project_id}")))
        .item("SK", AttributeValue::S(format!("INVITE#{id}")))
        .item("type", AttributeValue::S("Invite".into()))
        .item("inviteId", AttributeValue::S(id.clone()))
        .item("projectId", AttributeValue::S(project_id.to_string()))
        .item("token", AttributeValue::S(token.clone()))
        .item("code", AttributeValue::S(short_code.clone()))
        .item("role", AttributeValue::S(role.as_str().into()))
        .item("useCount", AttributeValue::N("0".into()))
        .item("issuedBy", AttributeValue::S(issuer.user_id.clone()))
        .item("issuedAt", AttributeValue::S(now.to_rfc3339()))
        .item(
            "GSI1PK",
            AttributeValue::S(format!("INVITETOKEN#{token}")),
        )
        .item("GSI1SK", AttributeValue::S("INVITE".into()))
        .item(
            "GSI2PK",
            AttributeValue::S(format!("INVITECODE#{short_code}")),
        )
        .item("GSI2SK", AttributeValue::S("INVITE".into()));

    if let Some(max) = max_uses {
        put = put.item("maxUses", AttributeValue::N(max.to_string()));
    }
    if let Some(exp) = expires_at {
        put = put.item("expiresAt", AttributeValue::S(exp.to_rfc3339()));
    }
    if let Some(n) = &note {
        put = put.item("note", AttributeValue::S(n.clone()));
    }

    put.send().await?;

    Ok(Invite {
        id,
        project_id: project_id.to_string(),
        token,
        code: short_code,
        role,
        max_uses,
        use_count: 0,
        expires_at,
        note,
        issued_by: issuer.user_id.clone(),
        issued_at: now,
        revoked_at: None,
    })
}

pub async fn get_by_token(state: &AppState, token: &str) -> Result<Invite, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .index_name("GSI1")
        .key_condition_expression("GSI1PK = :pk AND GSI1SK = :sk")
        .expression_attribute_values(
            ":pk",
            AttributeValue::S(format!("INVITETOKEN#{token}")),
        )
        .expression_attribute_values(":sk", AttributeValue::S("INVITE".into()))
        .limit(1)
        .send()
        .await?;
    let item = q
        .items
        .and_then(|mut v| v.pop())
        .ok_or(AppError::NotFound)?;
    invite_from_item(&item)
}

pub async fn get_by_code(state: &AppState, code: &str) -> Result<Invite, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .index_name("GSI2")
        .key_condition_expression("GSI2PK = :pk AND GSI2SK = :sk")
        .expression_attribute_values(
            ":pk",
            AttributeValue::S(format!("INVITECODE#{code}")),
        )
        .expression_attribute_values(":sk", AttributeValue::S("INVITE".into()))
        .limit(1)
        .send()
        .await?;
    let item = q
        .items
        .and_then(|mut v| v.pop())
        .ok_or(AppError::NotFound)?;
    invite_from_item(&item)
}

pub async fn list_for_project(
    state: &AppState,
    project_id: &str,
) -> Result<Vec<Invite>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .expression_attribute_values(
            ":pk",
            AttributeValue::S(format!("PROJECT#{project_id}")),
        )
        .expression_attribute_values(":sk", AttributeValue::S("INVITE#".into()))
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        out.push(invite_from_item(&item)?);
    }
    Ok(out)
}

/// Atomically increment `useCount`, but only if the invite is still valid
/// (not revoked, not expired, under max_uses). Returns the refreshed Invite
/// on success or `Conflict` if the constraint failed.
pub async fn consume(state: &AppState, invite: &Invite) -> Result<Invite, AppError> {
    let now = Utc::now();
    let pk = AttributeValue::S(format!("PROJECT#{}", invite.project_id));
    let sk = AttributeValue::S(format!("INVITE#{}", invite.id));

    let mut update = state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", pk)
        .key("SK", sk)
        .update_expression("ADD useCount :one")
        .expression_attribute_values(":one", AttributeValue::N("1".into()))
        .return_values(aws_sdk_dynamodb::types::ReturnValue::AllNew);

    let mut conds: Vec<&str> = vec!["attribute_not_exists(revokedAt)"];

    if let Some(max) = invite.max_uses {
        conds.push("useCount < :max");
        update = update.expression_attribute_values(":max", AttributeValue::N(max.to_string()));
    }
    if invite.expires_at.is_some() {
        conds.push("expiresAt > :now");
        update = update
            .expression_attribute_values(":now", AttributeValue::S(now.to_rfc3339()));
    }

    if !conds.is_empty() {
        update = update.condition_expression(conds.join(" AND "));
    }

    let result = update.send().await;
    match result {
        Ok(r) => {
            let attrs = r.attributes.ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(
                    "update returned no attributes",
                )))
            })?;
            invite_from_item(&attrs)
        }
        Err(err) => {
            let svc = err.into_service_error();
            if svc.is_conditional_check_failed_exception() {
                Err(AppError::Conflict(
                    "invite has been revoked, expired, or used up".into(),
                ))
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

pub async fn revoke(
    state: &AppState,
    project_id: &str,
    invite_id: &str,
) -> Result<(), AppError> {
    let now = Utc::now();
    state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("PROJECT#{project_id}")))
        .key("SK", AttributeValue::S(format!("INVITE#{invite_id}")))
        .update_expression("SET revokedAt = :ts")
        .expression_attribute_values(":ts", AttributeValue::S(now.to_rfc3339()))
        .condition_expression("attribute_exists(PK)")
        .send()
        .await
        .map(|_| ())
        .map_err(|err| {
            let svc = err.into_service_error();
            if svc.is_conditional_check_failed_exception() {
                AppError::NotFound
            } else {
                AppError::Internal(Box::new(svc))
            }
        })
}

fn random_token() -> String {
    const ALPHABET: &[u8] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();
    (0..32)
        .map(|_| ALPHABET[rng.gen_range(0..ALPHABET.len())] as char)
        .collect()
}

fn invite_from_item(item: &HashMap<String, AttributeValue>) -> Result<Invite, AppError> {
    fn s<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Result<&'a str, AppError> {
        item.get(key)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
            .ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(format!(
                    "invite missing field: {key}"
                ))))
            })
    }
    fn n_opt(item: &HashMap<String, AttributeValue>, key: &str) -> Option<i64> {
        item.get(key)
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<i64>().ok())
    }
    fn s_opt<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Option<&'a str> {
        item.get(key).and_then(|v| v.as_s().ok()).map(String::as_str)
    }

    let role: Role = s(item, "role")?.parse()?;
    let issued_at = chrono::DateTime::parse_from_rfc3339(s(item, "issuedAt")?)
        .map_err(|e| AppError::Internal(Box::new(e)))?
        .with_timezone(&Utc);
    let expires_at = s_opt(item, "expiresAt")
        .map(|s| {
            chrono::DateTime::parse_from_rfc3339(s)
                .map(|d| d.with_timezone(&Utc))
                .map_err(|e| AppError::Internal(Box::new(e)))
        })
        .transpose()?;
    let revoked_at = s_opt(item, "revokedAt")
        .map(|s| {
            chrono::DateTime::parse_from_rfc3339(s)
                .map(|d| d.with_timezone(&Utc))
                .map_err(|e| AppError::Internal(Box::new(e)))
        })
        .transpose()?;

    Ok(Invite {
        id: s(item, "inviteId")?.to_string(),
        project_id: s(item, "projectId")?.to_string(),
        token: s(item, "token")?.to_string(),
        code: s(item, "code")?.to_string(),
        role,
        max_uses: n_opt(item, "maxUses"),
        use_count: n_opt(item, "useCount").unwrap_or(0),
        expires_at,
        note: s_opt(item, "note").map(String::from),
        issued_by: s(item, "issuedBy")?.to_string(),
        issued_at,
        revoked_at,
    })
}
