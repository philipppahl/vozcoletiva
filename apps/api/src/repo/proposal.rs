use std::collections::HashMap;

use aws_sdk_dynamodb::types::AttributeValue;
use chrono::{DateTime, Utc};
use serde::Serialize;
use ulid::Ulid;

use crate::auth::AuthenticatedUser;
use crate::domain::proposal::{ProposalStatus, Tally};
use crate::domain::voting_rule::VotingRule;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct Proposal {
    pub id: String,
    pub project_id: String,
    /// Root of this proposal's deliberation. Equals `id` for a root; set to the
    /// root's id for forks/options (slice B). Votes key on `DELIB#<root_id>`.
    pub root_id: String,
    pub author_id: String,
    pub title: String,
    pub body: String,
    pub voting_rule: VotingRule,
    pub quorum: Option<i64>,
    pub ends_at: DateTime<Utc>,
    pub status: ProposalStatus,
    pub tally: Tally,
    pub created_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub schedule_arn: Option<String>,
}

#[allow(clippy::too_many_arguments)]
pub async fn create(
    state: &AppState,
    project_id: &str,
    author: &AuthenticatedUser,
    title: String,
    body: String,
    voting_rule: VotingRule,
    quorum: Option<i64>,
    ends_at: DateTime<Utc>,
) -> Result<Proposal, AppError> {
    let id = Ulid::new().to_string();
    let now = Utc::now();
    let proposal = Proposal {
        id: id.clone(),
        project_id: project_id.to_string(),
        root_id: id.clone(),
        author_id: author.user_id.clone(),
        title,
        body,
        voting_rule,
        quorum,
        ends_at,
        status: ProposalStatus::Voting,
        tally: Tally::default(),
        created_at: now,
        closed_at: None,
        schedule_arn: None,
    };

    let mut put = state
        .ddb
        .put_item()
        .table_name(&state.table_name)
        .item("PK", AttributeValue::S(format!("PROJECT#{project_id}")))
        .item("SK", AttributeValue::S(format!("PROPOSAL#{id}")))
        .item("type", AttributeValue::S("Proposal".into()))
        .item("proposalId", AttributeValue::S(proposal.id.clone()))
        .item("projectId", AttributeValue::S(proposal.project_id.clone()))
        .item("authorId", AttributeValue::S(proposal.author_id.clone()))
        .item("title", AttributeValue::S(proposal.title.clone()))
        .item("body", AttributeValue::S(proposal.body.clone()))
        .item("rootId", AttributeValue::S(proposal.root_id.clone()))
        .item("votingRule", AttributeValue::S(voting_rule.as_str().into()))
        .item("endsAt", AttributeValue::S(ends_at.to_rfc3339()))
        .item(
            "status",
            AttributeValue::S(ProposalStatus::Voting.as_str().into()),
        )
        // Per-deliberation tally, materialised on the root head. `tallyByChoice`
        // starts as an empty map so vote writes can `ADD tallyByChoice.<id>`.
        .item("tallyByChoice", AttributeValue::M(HashMap::new()))
        .item("tallyNone", AttributeValue::N("0".into()))
        .item("tallyAbstain", AttributeValue::N("0".into()))
        .item("createdAt", AttributeValue::S(now.to_rfc3339()))
        // Closing-soon window lives on GSI3 (`PROJECT#p#VOTING` → endsAt), per
        // docs/data-model.md. Sparse: only roots in `voting` carry the GSI3 keys.
        .item(
            "GSI3PK",
            AttributeValue::S(format!("PROJECT#{project_id}#VOTING")),
        )
        .item("GSI3SK", AttributeValue::S(ends_at.to_rfc3339()))
        .condition_expression("attribute_not_exists(PK)");

    if let Some(q) = quorum {
        put = put.item("quorum", AttributeValue::N(q.to_string()));
    }

    put.send().await?;
    Ok(proposal)
}

pub async fn get(
    state: &AppState,
    project_id: &str,
    proposal_id: &str,
) -> Result<Proposal, AppError> {
    let r = state
        .ddb
        .get_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("PROJECT#{project_id}")))
        .key("SK", AttributeValue::S(format!("PROPOSAL#{proposal_id}")))
        .send()
        .await?;
    proposal_from_item(&r.item.ok_or(AppError::NotFound)?)
}

pub async fn list_for_project(
    state: &AppState,
    project_id: &str,
) -> Result<Vec<Proposal>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("PROJECT#{project_id}")))
        .expression_attribute_values(":sk", AttributeValue::S("PROPOSAL#".into()))
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        out.push(proposal_from_item(&item)?);
    }
    Ok(out)
}

/// Set the EventBridge schedule ARN on a freshly created proposal. Used by the
/// API after it provisions the close-schedule. Not strictly required (the
/// schedule self-describes via its name), but useful for diagnostics + delete.
pub async fn set_schedule_arn(
    state: &AppState,
    project_id: &str,
    proposal_id: &str,
    arn: &str,
) -> Result<(), AppError> {
    state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("PROJECT#{project_id}")))
        .key("SK", AttributeValue::S(format!("PROPOSAL#{proposal_id}")))
        .update_expression("SET scheduleArn = :arn")
        .expression_attribute_values(":arn", AttributeValue::S(arn.into()))
        .condition_expression("attribute_exists(PK)")
        .send()
        .await?;
    Ok(())
}

/// Transition a proposal to a terminal state. Idempotent: succeeds only if the
/// proposal is currently `voting`. Also drops it off GSI3's `VOTING`
/// partition so the "closing soon" view no longer surfaces it.
pub async fn transition_to_terminal(
    state: &AppState,
    project_id: &str,
    proposal_id: &str,
    new_status: ProposalStatus,
) -> Result<bool, AppError> {
    if !new_status.is_terminal() {
        return Err(AppError::BadRequest(
            "transition_to_terminal requires a terminal status".into(),
        ));
    }
    let now = Utc::now();
    let result = state
        .ddb
        .update_item()
        .table_name(&state.table_name)
        .key("PK", AttributeValue::S(format!("PROJECT#{project_id}")))
        .key("SK", AttributeValue::S(format!("PROPOSAL#{proposal_id}")))
        .update_expression(
            "SET #s = :new, closedAt = :ts \
             REMOVE GSI3PK, GSI3SK",
        )
        .expression_attribute_names("#s", "status")
        .expression_attribute_values(":new", AttributeValue::S(new_status.as_str().into()))
        .expression_attribute_values(":ts", AttributeValue::S(now.to_rfc3339()))
        .expression_attribute_values(
            ":voting",
            AttributeValue::S(ProposalStatus::Voting.as_str().into()),
        )
        .condition_expression("#s = :voting")
        .send()
        .await;

    match result {
        Ok(_) => Ok(true),
        Err(err) => {
            let svc = err.into_service_error();
            if svc.is_conditional_check_failed_exception() {
                // Already terminal — idempotent no-op.
                Ok(false)
            } else {
                Err(AppError::Internal(Box::new(svc)))
            }
        }
    }
}

pub fn proposal_from_item(item: &HashMap<String, AttributeValue>) -> Result<Proposal, AppError> {
    fn s<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Result<&'a str, AppError> {
        item.get(key)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
            .ok_or_else(|| {
                AppError::Internal(Box::new(std::io::Error::other(format!(
                    "proposal missing field: {key}"
                ))))
            })
    }
    fn n_opt(item: &HashMap<String, AttributeValue>, key: &str) -> Option<i64> {
        item.get(key)
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<i64>().ok())
    }
    fn s_opt<'a>(item: &'a HashMap<String, AttributeValue>, key: &str) -> Option<&'a str> {
        item.get(key)
            .and_then(|v| v.as_s().ok())
            .map(String::as_str)
    }

    fn tally_map(item: &HashMap<String, AttributeValue>, key: &str) -> HashMap<String, i64> {
        item.get(key)
            .and_then(|v| v.as_m().ok())
            .map(|m| {
                m.iter()
                    .filter_map(|(k, v)| {
                        v.as_n()
                            .ok()
                            .and_then(|s| s.parse::<i64>().ok())
                            .map(|n| (k.clone(), n))
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    let status: ProposalStatus = s(item, "status")?.parse()?;
    let voting_rule: VotingRule = s(item, "votingRule")?.parse()?;
    let ends_at = chrono::DateTime::parse_from_rfc3339(s(item, "endsAt")?)
        .map_err(|e| AppError::Internal(Box::new(e)))?
        .with_timezone(&Utc);
    let created_at = chrono::DateTime::parse_from_rfc3339(s(item, "createdAt")?)
        .map_err(|e| AppError::Internal(Box::new(e)))?
        .with_timezone(&Utc);
    let closed_at = s_opt(item, "closedAt")
        .map(|s| {
            chrono::DateTime::parse_from_rfc3339(s)
                .map(|d| d.with_timezone(&Utc))
                .map_err(|e| AppError::Internal(Box::new(e)))
        })
        .transpose()?;

    let proposal_id = s(item, "proposalId")?.to_string();
    Ok(Proposal {
        id: proposal_id.clone(),
        project_id: s(item, "projectId")?.to_string(),
        // Pre-slice-A items have no rootId; fall back to the proposal's own id
        // (they were all roots anyway).
        root_id: s_opt(item, "rootId")
            .map(String::from)
            .unwrap_or(proposal_id),
        author_id: s(item, "authorId")?.to_string(),
        title: s(item, "title")?.to_string(),
        body: s(item, "body")?.to_string(),
        voting_rule,
        quorum: n_opt(item, "quorum"),
        ends_at,
        status,
        tally: Tally {
            by_choice: tally_map(item, "tallyByChoice"),
            none: n_opt(item, "tallyNone").unwrap_or(0),
            abstain: n_opt(item, "tallyAbstain").unwrap_or(0),
        },
        created_at,
        closed_at,
        schedule_arn: s_opt(item, "scheduleArn").map(String::from),
    })
}
