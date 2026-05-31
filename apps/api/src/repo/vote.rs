use std::collections::HashMap;

use aws_sdk_dynamodb::types::{AttributeValue, Delete, Put, TransactWriteItem, Update};
use chrono::Utc;
use ulid::Ulid;

use crate::auth::AuthenticatedUser;
use crate::domain::vote::Choice;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone)]
pub struct Vote {
    pub user_id: String,
    pub choice: Choice,
    pub voted_at: String,
}

/// The user's current vote in a deliberation (keyed on the root), if any.
pub async fn get(state: &AppState, root_id: &str, user_id: &str) -> Result<Option<Vote>, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("DELIB#{root_id}")))
        .key("SK", AttributeValue::S(format!("VOTE#{user_id}")))
        .send()
        .await?;
    let Some(item) = r.item else {
        return Ok(None);
    };
    let choice: Choice = string_field(&item, "choice")?.parse()?;
    Ok(Some(Vote {
        user_id: user_id.to_string(),
        choice,
        voted_at: string_field(&item, "votedAt")?.to_string(),
    }))
}

/// Every vote in a deliberation (keyed on the root). Used to fan out
/// `proposal-closed` notifications to voters.
pub async fn voters(state: &AppState, root_id: &str) -> Result<Vec<Vote>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("DELIB#{root_id}")))
        .expression_attribute_values(":sk", AttributeValue::S("VOTE#".into()))
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        let choice: Choice = string_field(&item, "choice")?.parse()?;
        out.push(Vote {
            user_id: string_field(&item, "userId")?.to_string(),
            choice,
            voted_at: string_field(&item, "votedAt")?.to_string(),
        });
    }
    Ok(out)
}

/// Cast a vote (or change it) in a deliberation. Atomic across:
///   * Vote item (current materialised choice) under `DELIB#<root>`
///   * VoteEvent item (append-only audit) under `DELIB#<root>`
///   * The root proposal head's `byChoice` / `none` / `abstain` tally
///
/// One DynamoDB TransactWriteItems. Guarded by:
///   * Root head status = voting AND endsAt > now (cannot vote on a closed
///     deliberation) — carried on the head Update.
///   * Vote item state matches `previous` (optimistic concurrency). A racing
///     write fails the conditional check → `Conflict`.
pub async fn cast(
    state: &AppState,
    user: &AuthenticatedUser,
    project_id: &str,
    root_id: &str,
    new_choice: Choice,
    previous: Option<Choice>,
) -> Result<(), AppError> {
    let now_str = Utc::now().to_rfc3339();
    let event_sk = format!("VOTEEVENT#{}", Ulid::new());

    let head_update = build_tally_update(
        &state.table_name,
        project_id,
        root_id,
        &now_str,
        previous.as_ref(),
        Some(&new_choice),
    );

    let mut vote_put = Put::builder()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(format!("DELIB#{root_id}")))
        .item("SK", AttributeValue::S(format!("VOTE#{}", user.user_id)))
        .item("type", AttributeValue::S("Vote".into()))
        .item("rootId", AttributeValue::S(root_id.to_string()))
        .item("userId", AttributeValue::S(user.user_id.clone()))
        .item("choice", AttributeValue::S(new_choice.wire().to_string()))
        .item("votedAt", AttributeValue::S(now_str.clone()))
        .item(
            "GSI2PK",
            AttributeValue::S(format!("USER#{}", user.user_id)),
        )
        .item("GSI2SK", AttributeValue::S(format!("VOTE#{root_id}")));

    vote_put = match previous.as_ref() {
        // First vote — the vote item must not exist.
        None => vote_put.condition_expression("attribute_not_exists(PK)"),
        // Change — the vote item must exist with the previous choice.
        Some(prev) => vote_put
            .condition_expression("attribute_exists(PK) AND choice = :prev")
            .expression_attribute_values(":prev", AttributeValue::S(prev.wire().to_string())),
    };
    let vote_put = vote_put
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    let event_put = build_event_put(
        &state.table_name,
        root_id,
        &event_sk,
        &user.user_id,
        Some(&new_choice),
        previous.as_ref(),
        &now_str,
    )?;

    let result = state
        .ddb
        .transact_write_items()
        .transact_items(TransactWriteItem::builder().update(head_update).build())
        .transact_items(TransactWriteItem::builder().put(vote_put).build())
        .transact_items(TransactWriteItem::builder().put(event_put).build())
        .send()
        .await;
    map_transact_error(result)
}

/// Retract a vote. Symmetrical with `cast`: vote item deleted, tally
/// decremented, a retraction event recorded.
pub async fn retract(
    state: &AppState,
    user: &AuthenticatedUser,
    project_id: &str,
    root_id: &str,
    previous: Choice,
) -> Result<(), AppError> {
    let now_str = Utc::now().to_rfc3339();
    let event_sk = format!("VOTEEVENT#{}", Ulid::new());

    let head_update = build_tally_update(
        &state.table_name,
        project_id,
        root_id,
        &now_str,
        Some(&previous),
        None,
    );

    let vote_delete = Delete::builder()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("DELIB#{root_id}")))
        .key("SK", AttributeValue::S(format!("VOTE#{}", user.user_id)))
        .condition_expression("attribute_exists(PK) AND choice = :prev")
        .expression_attribute_values(":prev", AttributeValue::S(previous.wire().to_string()))
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    let event_put = build_event_put(
        &state.table_name,
        root_id,
        &event_sk,
        &user.user_id,
        None,
        Some(&previous),
        &now_str,
    )?;

    let result = state
        .ddb
        .transact_write_items()
        .transact_items(TransactWriteItem::builder().update(head_update).build())
        .transact_items(TransactWriteItem::builder().delete(vote_delete).build())
        .transact_items(TransactWriteItem::builder().put(event_put).build())
        .send()
        .await;
    map_transact_error(result)
}

/// Build the root-head Update that adjusts the tally and guards the vote.
///
/// Routes each of `previous` (−1) and `new` (+1) to its bucket:
///   * `Pick(id)` → `tallyByChoice.<id>`
///   * `NoneOfThese` → `tallyNone`
///   * `Abstain` → `tallyAbstain`
///
/// Deltas are accumulated per bucket so a no-op (re-affirming the same choice)
/// collapses to zero and isn't emitted. A harmless `SET lastVoteAt` keeps the
/// expression non-empty when there's no net tally change.
fn build_tally_update(
    table_name: &str,
    project_id: &str,
    root_id: &str,
    now: &str,
    previous: Option<&Choice>,
    new: Option<&Choice>,
) -> Update {
    let mut pick_deltas: HashMap<String, i64> = HashMap::new();
    let mut none_delta = 0i64;
    let mut abstain_delta = 0i64;

    let mut route = |choice: &Choice, sign: i64| match choice {
        Choice::Pick(id) => {
            *pick_deltas.entry(id.clone()).or_insert(0) += sign;
        }
        Choice::NoneOfThese => none_delta += sign,
        Choice::Abstain => abstain_delta += sign,
    };
    if let Some(p) = previous {
        route(p, -1);
    }
    if let Some(n) = new {
        route(n, 1);
    }

    let mut names: HashMap<String, String> = HashMap::new();
    let mut values: HashMap<String, AttributeValue> = HashMap::new();
    let mut add_parts: Vec<String> = Vec::new();

    for (ki, (id, delta)) in pick_deltas.into_iter().filter(|(_, d)| *d != 0).enumerate() {
        let nk = format!("#k{ki}");
        let vk = format!(":d{ki}");
        names.insert(nk.clone(), id);
        values.insert(vk.clone(), AttributeValue::N(delta.to_string()));
        add_parts.push(format!("tallyByChoice.{nk} {vk}"));
    }
    if none_delta != 0 {
        values.insert(":nd".into(), AttributeValue::N(none_delta.to_string()));
        add_parts.push("tallyNone :nd".into());
    }
    if abstain_delta != 0 {
        values.insert(":ad".into(), AttributeValue::N(abstain_delta.to_string()));
        add_parts.push("tallyAbstain :ad".into());
    }

    values.insert(":lva".into(), AttributeValue::S(now.to_string()));
    let mut update_expr = String::from("SET lastVoteAt = :lva");
    if !add_parts.is_empty() {
        update_expr.push_str(" ADD ");
        update_expr.push_str(&add_parts.join(", "));
    }

    // Guard: the root head must still be open.
    names.insert("#s".into(), "status".into());
    values.insert(":voting".into(), AttributeValue::S("voting".into()));
    values.insert(":now".into(), AttributeValue::S(now.to_string()));

    let mut b = Update::builder()
        .table_name(table_name)
        .key("PK", AttributeValue::S(format!("PROJECT#{project_id}")))
        .key("SK", AttributeValue::S(format!("PROPOSAL#{root_id}")))
        .update_expression(update_expr)
        .condition_expression("#s = :voting AND endsAt > :now");
    b = b.set_expression_attribute_names(Some(names));
    b = b.set_expression_attribute_values(Some(values));
    b.build().expect("tally update expression is well-formed")
}

fn build_event_put(
    table_name: &str,
    root_id: &str,
    event_sk: &str,
    user_id: &str,
    new: Option<&Choice>,
    previous: Option<&Choice>,
    now: &str,
) -> Result<Put, AppError> {
    Put::builder()
        .table_name(table_name)
        .item("PK", AttributeValue::S(format!("DELIB#{root_id}")))
        .item("SK", AttributeValue::S(event_sk.to_string()))
        .item("type", AttributeValue::S("VoteEvent".into()))
        .item("rootId", AttributeValue::S(root_id.to_string()))
        .item("userId", AttributeValue::S(user_id.to_string()))
        .item(
            "newChoice",
            new.map(|c| AttributeValue::S(c.wire().to_string()))
                .unwrap_or(AttributeValue::Null(true)),
        )
        .item(
            "previousChoice",
            previous
                .map(|c| AttributeValue::S(c.wire().to_string()))
                .unwrap_or(AttributeValue::Null(true)),
        )
        .item("ts", AttributeValue::S(now.to_string()))
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))
}

fn map_transact_error(
    result: Result<
        aws_sdk_dynamodb::operation::transact_write_items::TransactWriteItemsOutput,
        aws_sdk_dynamodb::error::SdkError<
            aws_sdk_dynamodb::operation::transact_write_items::TransactWriteItemsError,
        >,
    >,
) -> Result<(), AppError> {
    match result {
        Ok(_) => Ok(()),
        Err(err) => {
            let svc = err.into_service_error();
            let msg = svc.to_string();
            if msg.contains("ConditionalCheckFailed") {
                // Either the deliberation is closed/expired, or a vote race.
                Err(AppError::Conflict(
                    "voting is closed or your previous vote changed; refresh and try again".into(),
                ))
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

fn string_field<'a>(
    item: &'a HashMap<String, AttributeValue>,
    key: &str,
) -> Result<&'a str, AppError> {
    item.get(key)
        .and_then(|v| v.as_s().ok())
        .map(String::as_str)
        .ok_or_else(|| {
            AppError::Internal(Box::new(std::io::Error::other(format!(
                "vote missing field: {key}"
            ))))
        })
}
