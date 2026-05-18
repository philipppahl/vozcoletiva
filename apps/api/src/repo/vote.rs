use std::collections::HashMap;

use aws_sdk_dynamodb::types::{AttributeValue, Delete, Put, TransactWriteItem, Update};
use chrono::Utc;
use serde::Serialize;

use crate::auth::AuthenticatedUser;
use crate::domain::vote::Choice;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct Vote {
    pub user_id: String,
    pub choice: Choice,
    pub voted_at: String,
}

/// The user's current vote on a proposal, if any.
pub async fn get(
    state: &AppState,
    proposal_id: &str,
    user_id: &str,
) -> Result<Option<Vote>, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("PROPOSAL#{proposal_id}")))
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

/// Cast a vote (or change it). Atomic across:
///   * Vote item (current materialised choice)
///   * VoteEvent item (append-only audit)
///   * Proposal head's tally counters
///
/// All in one DynamoDB TransactWriteItems. The transaction is guarded by:
///   * Proposal status = voting AND endsAt > now (cannot vote on closed proposal)
///   * Vote item state matches the `previous` parameter we read just before
///     this call. If a concurrent write changed it, the transaction fails
///     with a conditional-check error and we return `Conflict`.
pub async fn cast(
    state: &AppState,
    user: &AuthenticatedUser,
    project_id: &str,
    proposal_id: &str,
    new_choice: Choice,
    previous: Option<Choice>,
) -> Result<(), AppError> {
    let now = Utc::now();
    let now_str = now.to_rfc3339();

    let proposal_key = (
        format!("PROJECT#{project_id}"),
        format!("PROPOSAL#{proposal_id}"),
    );
    let vote_key = (
        format!("PROPOSAL#{proposal_id}"),
        format!("VOTE#{user_id}", user_id = user.user_id),
    );
    let vote_event_sk = format!("VOTEEVENT#{now_str}#{}", user.user_id);

    let proposal_update = build_proposal_tally_update(
        &state.table_name,
        &proposal_key,
        &now_str,
        previous,
        Some(new_choice),
    );

    let vote_put = match previous {
        // First vote — vote item must not exist.
        None => Put::builder()
            .table_name(&state.table_name)
            .item("PK", AttributeValue::S(vote_key.0.clone()))
            .item("SK", AttributeValue::S(vote_key.1.clone()))
            .item("type", AttributeValue::S("Vote".into()))
            .item("proposalId", AttributeValue::S(proposal_id.to_string()))
            .item("userId", AttributeValue::S(user.user_id.clone()))
            .item("choice", AttributeValue::S(new_choice.as_str().into()))
            .item("votedAt", AttributeValue::S(now_str.clone()))
            .item(
                "GSI2PK",
                AttributeValue::S(format!("USER#{}", user.user_id)),
            )
            .item(
                "GSI2SK",
                AttributeValue::S(format!("VOTE#{project_id}#{proposal_id}")),
            )
            .condition_expression("attribute_not_exists(PK)")
            .build()
            .map_err(|e| AppError::Internal(Box::new(e)))?,
        // Change — vote item must exist with the previous choice.
        Some(prev) => Put::builder()
            .table_name(&state.table_name)
            .item("PK", AttributeValue::S(vote_key.0.clone()))
            .item("SK", AttributeValue::S(vote_key.1.clone()))
            .item("type", AttributeValue::S("Vote".into()))
            .item("proposalId", AttributeValue::S(proposal_id.to_string()))
            .item("userId", AttributeValue::S(user.user_id.clone()))
            .item("choice", AttributeValue::S(new_choice.as_str().into()))
            .item("votedAt", AttributeValue::S(now_str.clone()))
            .item(
                "GSI2PK",
                AttributeValue::S(format!("USER#{}", user.user_id)),
            )
            .item(
                "GSI2SK",
                AttributeValue::S(format!("VOTE#{project_id}#{proposal_id}")),
            )
            .condition_expression("attribute_exists(PK) AND choice = :prev")
            .expression_attribute_values(":prev", AttributeValue::S(prev.as_str().into()))
            .build()
            .map_err(|e| AppError::Internal(Box::new(e)))?,
    };

    let vote_event_put = Put::builder()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(format!("PROPOSAL#{proposal_id}")))
        .item("SK", AttributeValue::S(vote_event_sk))
        .item("type", AttributeValue::S("VoteEvent".into()))
        .item("proposalId", AttributeValue::S(proposal_id.to_string()))
        .item("userId", AttributeValue::S(user.user_id.clone()))
        .item("newChoice", AttributeValue::S(new_choice.as_str().into()))
        .item(
            "previousChoice",
            previous
                .map(|p| AttributeValue::S(p.as_str().into()))
                .unwrap_or(AttributeValue::Null(true)),
        )
        .item("ts", AttributeValue::S(now_str))
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    let result = state
        .ddb
        .transact_write_items()
        .transact_items(TransactWriteItem::builder().update(proposal_update).build())
        .transact_items(TransactWriteItem::builder().put(vote_put).build())
        .transact_items(TransactWriteItem::builder().put(vote_event_put).build())
        .send()
        .await;
    map_transact_error(result)
}

/// Retract a vote. Symmetrical with `cast`: vote item is deleted, tally
/// counters decremented, an event recorded.
pub async fn retract(
    state: &AppState,
    user: &AuthenticatedUser,
    project_id: &str,
    proposal_id: &str,
    previous: Choice,
) -> Result<(), AppError> {
    let now = Utc::now();
    let now_str = now.to_rfc3339();

    let proposal_key = (
        format!("PROJECT#{project_id}"),
        format!("PROPOSAL#{proposal_id}"),
    );
    let vote_key = (
        format!("PROPOSAL#{proposal_id}"),
        format!("VOTE#{user_id}", user_id = user.user_id),
    );
    let vote_event_sk = format!("VOTEEVENT#{now_str}#{}", user.user_id);

    let proposal_update = build_proposal_tally_update(
        &state.table_name,
        &proposal_key,
        &now_str,
        Some(previous),
        None,
    );

    let vote_delete = Delete::builder()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(vote_key.0.clone()))
        .key("SK", AttributeValue::S(vote_key.1.clone()))
        .condition_expression("attribute_exists(PK) AND choice = :prev")
        .expression_attribute_values(":prev", AttributeValue::S(previous.as_str().into()))
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    let vote_event_put = Put::builder()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(format!("PROPOSAL#{proposal_id}")))
        .item("SK", AttributeValue::S(vote_event_sk))
        .item("type", AttributeValue::S("VoteEvent".into()))
        .item("proposalId", AttributeValue::S(proposal_id.to_string()))
        .item("userId", AttributeValue::S(user.user_id.clone()))
        .item(
            "previousChoice",
            AttributeValue::S(previous.as_str().into()),
        )
        .item("newChoice", AttributeValue::Null(true))
        .item("ts", AttributeValue::S(now_str))
        .build()
        .map_err(|e| AppError::Internal(Box::new(e)))?;

    let result = state
        .ddb
        .transact_write_items()
        .transact_items(TransactWriteItem::builder().update(proposal_update).build())
        .transact_items(TransactWriteItem::builder().delete(vote_delete).build())
        .transact_items(TransactWriteItem::builder().put(vote_event_put).build())
        .send()
        .await;
    map_transact_error(result)
}

fn build_proposal_tally_update(
    table_name: &str,
    proposal_key: &(String, String),
    now: &str,
    previous: Option<Choice>,
    new: Option<Choice>,
) -> Update {
    // Express tally adjustment as an ADD expression. Each choice maps to its
    // counter attribute name. Adding by 0 is a no-op.
    let mut yes_delta = 0i64;
    let mut no_delta = 0i64;
    let mut abstain_delta = 0i64;
    let mut voter_delta = 0i64;

    if let Some(prev) = previous {
        match prev {
            Choice::Yes => yes_delta -= 1,
            Choice::No => no_delta -= 1,
            Choice::Abstain => abstain_delta -= 1,
        }
        if new.is_none() {
            voter_delta -= 1;
        }
    } else if new.is_some() {
        voter_delta += 1;
    }

    if let Some(c) = new {
        match c {
            Choice::Yes => yes_delta += 1,
            Choice::No => no_delta += 1,
            Choice::Abstain => abstain_delta += 1,
        }
    }

    Update::builder()
        .table_name(table_name)
        .key("PK", AttributeValue::S(proposal_key.0.clone()))
        .key("SK", AttributeValue::S(proposal_key.1.clone()))
        .update_expression(
            "ADD tallyYes :yd, tallyNo :nd, tallyAbstain :ad, voterCount :vd",
        )
        .expression_attribute_values(":yd", AttributeValue::N(yes_delta.to_string()))
        .expression_attribute_values(":nd", AttributeValue::N(no_delta.to_string()))
        .expression_attribute_values(":ad", AttributeValue::N(abstain_delta.to_string()))
        .expression_attribute_values(":vd", AttributeValue::N(voter_delta.to_string()))
        .expression_attribute_values(
            ":voting",
            AttributeValue::S("voting".into()),
        )
        .expression_attribute_values(":now", AttributeValue::S(now.to_string()))
        .condition_expression(
            "#s = :voting AND endsAt > :now",
        )
        .expression_attribute_names("#s", "status")
        .build()
        .expect("static update expression")
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
                // Could be: proposal not in voting / expired, or vote race.
                // Return Conflict for both — the FE can refetch and retry.
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
