use std::collections::HashMap;

use aws_sdk_dynamodb::types::{AttributeValue, TransactWriteItem, Update};
use chrono::{DateTime, Utc};
use serde::Serialize;
use ulid::Ulid;

use crate::auth::AuthenticatedUser;
use crate::domain::proposal::{ProposalKind, ProposalStatus, Tally};
use crate::domain::voting_rule::VotingRule;
use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct Proposal {
    pub id: String,
    pub project_id: String,
    /// Root of this proposal's deliberation. Equals `id` for a root; set to the
    /// root's id for forks/options. Votes key on `DELIB#<root_id>`.
    pub root_id: String,
    /// `None` for a root; the parent proposal's id for a fork/alternative.
    pub parent_id: Option<String>,
    /// Project-scoped category (topic). Roots set it from the request or the
    /// default; forks inherit the root's.
    pub category_id: String,
    /// Decision (default) or Document. Forks inherit the root's.
    pub proposal_kind: ProposalKind,
    /// Set only on Document-kind proposals — the stable document name this
    /// proposal is a version of. Forks inherit the root's.
    pub document_name: Option<String>,
    /// True on the root of a multi-option decision — it frames the question but
    /// is not itself a votable candidate; its children are the options.
    pub is_question: bool,
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
    category_id: String,
    proposal_kind: ProposalKind,
    document_name: Option<String>,
    is_question: bool,
) -> Result<Proposal, AppError> {
    let id = Ulid::new().to_string();
    let now = Utc::now();
    let proposal = Proposal {
        id: id.clone(),
        project_id: project_id.to_string(),
        root_id: id.clone(),
        parent_id: None,
        category_id,
        proposal_kind,
        document_name,
        is_question,
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
        .item(
            "categoryId",
            AttributeValue::S(proposal.category_id.clone()),
        )
        .item(
            "proposalKind",
            AttributeValue::S(proposal.proposal_kind.as_str().into()),
        )
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
        // Deliberation tree lives on GSI2 (`DELIB#<root>` → created-ordered),
        // so the root appears in its own tree alongside any forks.
        .item("GSI2PK", AttributeValue::S(format!("DELIB#{id}")))
        .item(
            "GSI2SK",
            AttributeValue::S(format!("PROPOSAL#{}#{id}", now.to_rfc3339())),
        )
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
    if let Some(name) = &proposal.document_name {
        put = put.item("documentName", AttributeValue::S(name.clone()));
    }
    // Sparse: only multi-option roots carry isQuestion.
    if is_question {
        put = put.item("isQuestion", AttributeValue::Bool(true));
    }

    put.send().await?;
    Ok(proposal)
}

/// Create a fork (alternative) under an existing deliberation. The fork is a
/// child proposal that inherits the root's voting rule / quorum / ends_at and
/// joins the tree via GSI2. It carries **no** tally or closing-soon keys — those
/// live on the root head; the whole deliberation closes on the root's schedule.
pub async fn create_fork(
    state: &AppState,
    project_id: &str,
    author: &AuthenticatedUser,
    title: String,
    body: String,
    parent_id: &str,
    root: &Proposal,
) -> Result<Proposal, AppError> {
    let id = Ulid::new().to_string();
    let now = Utc::now();
    let proposal = Proposal {
        id: id.clone(),
        project_id: project_id.to_string(),
        root_id: root.id.clone(),
        parent_id: Some(parent_id.to_string()),
        category_id: root.category_id.clone(),
        proposal_kind: root.proposal_kind,
        document_name: root.document_name.clone(),
        // A fork/option is always a candidate, never the question itself.
        is_question: false,
        author_id: author.user_id.clone(),
        title,
        body,
        voting_rule: root.voting_rule,
        quorum: root.quorum,
        ends_at: root.ends_at,
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
        .item("parentId", AttributeValue::S(parent_id.to_string()))
        .item("categoryId", AttributeValue::S(root.category_id.clone()))
        .item(
            "proposalKind",
            AttributeValue::S(root.proposal_kind.as_str().into()),
        )
        .item(
            "votingRule",
            AttributeValue::S(root.voting_rule.as_str().into()),
        )
        .item("endsAt", AttributeValue::S(root.ends_at.to_rfc3339()))
        .item(
            "status",
            AttributeValue::S(ProposalStatus::Voting.as_str().into()),
        )
        .item("createdAt", AttributeValue::S(now.to_rfc3339()))
        .item("GSI2PK", AttributeValue::S(format!("DELIB#{}", root.id)))
        .item(
            "GSI2SK",
            AttributeValue::S(format!("PROPOSAL#{}#{id}", now.to_rfc3339())),
        )
        .condition_expression("attribute_not_exists(PK)");

    if let Some(q) = root.quorum {
        put = put.item("quorum", AttributeValue::N(q.to_string()));
    }
    if let Some(name) = &root.document_name {
        put = put.item("documentName", AttributeValue::S(name.clone()));
    }

    put.send().await?;
    Ok(proposal)
}

/// The flat deliberation tree (root + all forks), created-ordered. The client
/// rebuilds nesting from `parent_id`.
pub async fn tree(state: &AppState, root_id: &str) -> Result<Vec<Proposal>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .index_name("GSI2")
        .key_condition_expression("GSI2PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S(format!("DELIB#{root_id}")))
        .send()
        .await?;
    let mut out = Vec::new();
    for item in q.items.unwrap_or_default() {
        out.push(proposal_from_item(&item)?);
    }
    Ok(out)
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

/// One node's terminal transition. `doc_index` is `Some(documentName)` only for
/// a **passed Document** node — it moves the item's GSI3 keys to the DOC
/// partition (`PROJECT#p#DOC` / `name#closedAt`) so it surfaces as a document
/// version; otherwise the GSI3 (closing-soon) keys are removed.
pub struct TreeTransition {
    pub proposal_id: String,
    pub status: ProposalStatus,
    pub doc_index: Option<String>,
}

/// Atomically transition a set of (already-`voting`) tree nodes to terminal
/// statuses in one transaction. Each update is guarded `status = voting` (so a
/// concurrently-withdrawn node fails the transaction rather than being
/// silently overwritten). Empty input is a no-op. Bounded by DynamoDB's
/// 100-item transaction limit — deliberation trees are far smaller.
pub async fn transition_tree_to_terminal(
    state: &AppState,
    project_id: &str,
    transitions: &[TreeTransition],
) -> Result<(), AppError> {
    if transitions.is_empty() {
        return Ok(());
    }
    let now = Utc::now().to_rfc3339();
    let mut items = Vec::with_capacity(transitions.len());
    for t in transitions {
        let mut update = Update::builder()
            .table_name(&state.table_name)
            .key("PK", AttributeValue::S(format!("PROJECT#{project_id}")))
            .key(
                "SK",
                AttributeValue::S(format!("PROPOSAL#{}", t.proposal_id)),
            )
            .expression_attribute_names("#s", "status")
            .expression_attribute_values(":new", AttributeValue::S(t.status.as_str().into()))
            .expression_attribute_values(":ts", AttributeValue::S(now.clone()))
            .expression_attribute_values(
                ":voting",
                AttributeValue::S(ProposalStatus::Voting.as_str().into()),
            )
            .condition_expression("#s = :voting");

        update = match &t.doc_index {
            // Passed document version → index it on the DOC partition.
            Some(name) => update
                .update_expression("SET #s = :new, closedAt = :ts, GSI3PK = :dpk, GSI3SK = :dsk")
                .expression_attribute_values(
                    ":dpk",
                    AttributeValue::S(format!("PROJECT#{project_id}#DOC")),
                )
                .expression_attribute_values(":dsk", AttributeValue::S(format!("{name}#{now}"))),
            // Everything else → drop the closing-soon keys.
            None => update.update_expression("SET #s = :new, closedAt = :ts REMOVE GSI3PK, GSI3SK"),
        };

        let update = update
            .build()
            .map_err(|e| AppError::Internal(Box::new(e)))?;
        items.push(TransactWriteItem::builder().update(update).build());
    }
    state
        .ddb
        .transact_write_items()
        .set_transact_items(Some(items))
        .send()
        .await?;
    Ok(())
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
        parent_id: s_opt(item, "parentId").map(String::from),
        category_id: s_opt(item, "categoryId").unwrap_or("").to_string(),
        proposal_kind: s_opt(item, "proposalKind")
            .map(|k| k.parse())
            .transpose()?
            .unwrap_or(ProposalKind::Decision),
        document_name: s_opt(item, "documentName").map(String::from),
        is_question: item
            .get("isQuestion")
            .and_then(|v| v.as_bool().ok())
            .copied()
            .unwrap_or(false),
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
