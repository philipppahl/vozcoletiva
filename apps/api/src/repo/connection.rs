//! WebSocket connection registry (decision 0028).
//!
//! Two items per live connection so we can resolve in both directions:
//!   `CONN#<connectionId>/META`        → which user owns this connection
//!   `USER#<uid>/CONN#<connectionId>`  → a user's live connections (for broadcast)
//!
//! Both carry a `ttl` (epoch seconds) as a backstop: API Gateway caps a socket
//! at ~2 h, and a missed `$disconnect` (Lambda error, cold-start race) would
//! otherwise leak a row forever. The realtime broadcaster also prunes on the
//! first failed `PostToConnection` (410 Gone), so the TTL is belt-and-braces.

use aws_sdk_dynamodb::types::{AttributeValue, Put, TransactWriteItem};

use crate::error::AppError;
use crate::state::AppState;

fn conn_pk(connection_id: &str) -> String {
    format!("CONN#{connection_id}")
}
fn user_pk(user_id: &str) -> String {
    format!("USER#{user_id}")
}
fn conn_sk(connection_id: &str) -> String {
    format!("CONN#{connection_id}")
}

/// Register a freshly-connected socket. Writes both directional items in one
/// transaction so a broadcast never sees a half-registered connection.
pub async fn add(
    state: &AppState,
    connection_id: &str,
    user_id: &str,
    connected_at: &str,
    ttl_epoch: i64,
) -> Result<(), AppError> {
    let meta = Put::builder()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(conn_pk(connection_id)))
        .item("SK", AttributeValue::S("META".into()))
        .item("type", AttributeValue::S("WsConnection".into()))
        .item("connectionId", AttributeValue::S(connection_id.to_string()))
        .item("userId", AttributeValue::S(user_id.to_string()))
        .item("connectedAt", AttributeValue::S(connected_at.to_string()))
        .item("ttl", AttributeValue::N(ttl_epoch.to_string()))
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;
    let pointer = Put::builder()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(user_pk(user_id)))
        .item("SK", AttributeValue::S(conn_sk(connection_id)))
        .item("type", AttributeValue::S("WsConnectionPointer".into()))
        .item("connectionId", AttributeValue::S(connection_id.to_string()))
        .item("userId", AttributeValue::S(user_id.to_string()))
        .item("connectedAt", AttributeValue::S(connected_at.to_string()))
        .item("ttl", AttributeValue::N(ttl_epoch.to_string()))
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;
    state
        .ddb
        .transact_write_items()
        .transact_items(TransactWriteItem::builder().put(meta).build())
        .transact_items(TransactWriteItem::builder().put(pointer).build())
        .send()
        .await?;
    Ok(())
}

/// The user that owns a connection, or `None` if it's already gone.
pub async fn owner(state: &AppState, connection_id: &str) -> Result<Option<String>, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(conn_pk(connection_id)))
        .key("SK", AttributeValue::S("META".into()))
        .send()
        .await?;
    Ok(r.item
        .as_ref()
        .and_then(|i| i.get("userId"))
        .and_then(|v| v.as_s().ok())
        .cloned())
}

/// Remove a connection on `$disconnect`. Resolves the owner first so both
/// directional items go. Idempotent — deleting an absent item is a no-op.
pub async fn remove(state: &AppState, connection_id: &str) -> Result<(), AppError> {
    if let Some(user_id) = owner(state, connection_id).await? {
        remove_pair(state, connection_id, &user_id).await
    } else {
        // No META (already pruned): best-effort delete of the META key anyway.
        state
            .ddb
            .delete_item()
            .table_name(&state.table_name)
            .key("PK", AttributeValue::S(conn_pk(connection_id)))
            .key("SK", AttributeValue::S("META".into()))
            .send()
            .await?;
        Ok(())
    }
}

/// Delete both directional items for a known (connection, user) pair. Used by
/// `$disconnect` and by the broadcaster pruning a 410-Gone connection (where it
/// already knows the user it was broadcasting to).
pub async fn remove_pair(
    state: &AppState,
    connection_id: &str,
    user_id: &str,
) -> Result<(), AppError> {
    state
        .ddb
        .delete_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(conn_pk(connection_id)))
        .key("SK", AttributeValue::S("META".into()))
        .send()
        .await?;
    state
        .ddb
        .delete_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(user_pk(user_id)))
        .key("SK", AttributeValue::S(conn_sk(connection_id)))
        .send()
        .await?;
    Ok(())
}

/// A user's currently-registered connection ids (for fan-out broadcast).
pub async fn list_for_user(state: &AppState, user_id: &str) -> Result<Vec<String>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .expression_attribute_values(":pk", AttributeValue::S(user_pk(user_id)))
        .expression_attribute_values(":sk", AttributeValue::S("CONN#".into()))
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        if let Some(id) = item.get("connectionId").and_then(|v| v.as_s().ok()) {
            out.push(id.clone());
        }
    }
    Ok(out)
}
