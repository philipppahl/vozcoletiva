//! Documents are a derived view over Document-kind proposals — there is no
//! Document entity (decision 0004). A "document" is the set of passed
//! `proposal_kind = document` proposals sharing a `document_name`; the current
//! version is the most-recently-closed. Passed versions are indexed on GSI3's
//! `PROJECT#p#DOC` partition (set at close); active amendments are voting
//! Document roots, found by a filtered scan of the project's proposals.

use aws_sdk_dynamodb::types::AttributeValue;

use crate::error::AppError;
use crate::repo::proposal::{proposal_from_item, Proposal};
use crate::state::AppState;

/// All passed document versions in the project (every name), via the GSI3 DOC
/// partition. The caller groups by `document_name`.
pub async fn passed_versions(
    state: &AppState,
    project_id: &str,
) -> Result<Vec<Proposal>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .index_name("GSI3")
        .key_condition_expression("GSI3PK = :pk")
        .expression_attribute_values(
            ":pk",
            AttributeValue::S(format!("PROJECT#{project_id}#DOC")),
        )
        .send()
        .await?;
    collect(q.items)
}

/// Passed versions for one document name, most-recently-closed first.
pub async fn versions_for_name(
    state: &AppState,
    project_id: &str,
    name: &str,
) -> Result<Vec<Proposal>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .index_name("GSI3")
        .key_condition_expression("GSI3PK = :pk AND begins_with(GSI3SK, :sk)")
        .expression_attribute_values(
            ":pk",
            AttributeValue::S(format!("PROJECT#{project_id}#DOC")),
        )
        .expression_attribute_values(":sk", AttributeValue::S(format!("{name}#")))
        .scan_index_forward(false)
        .send()
        .await?;
    collect(q.items)
}

/// Voting Document roots in the project (active amendments). The caller maps by
/// `document_name`.
pub async fn active_doc_roots(
    state: &AppState,
    project_id: &str,
) -> Result<Vec<Proposal>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .filter_expression(
            "proposalKind = :doc AND #s = :voting AND attribute_not_exists(parentId)",
        )
        .expression_attribute_names("#s", "status")
        .expression_attribute_values(":pk", AttributeValue::S(format!("PROJECT#{project_id}")))
        .expression_attribute_values(":sk", AttributeValue::S("PROPOSAL#".into()))
        .expression_attribute_values(":doc", AttributeValue::S("document".into()))
        .expression_attribute_values(":voting", AttributeValue::S("voting".into()))
        .send()
        .await?;
    collect(q.items)
}

/// The active (voting) Document deliberation for a name, if any. Enforces the
/// "at most one active deliberation per document" rule.
pub async fn active_for_name(
    state: &AppState,
    project_id: &str,
    name: &str,
) -> Result<Option<Proposal>, AppError> {
    let q = state
        .ddb
        .query()
        .table_name(&state.table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .filter_expression(
            "proposalKind = :doc AND #s = :voting AND attribute_not_exists(parentId) AND documentName = :name",
        )
        .expression_attribute_names("#s", "status")
        .expression_attribute_values(":pk", AttributeValue::S(format!("PROJECT#{project_id}")))
        .expression_attribute_values(":sk", AttributeValue::S("PROPOSAL#".into()))
        .expression_attribute_values(":doc", AttributeValue::S("document".into()))
        .expression_attribute_values(":voting", AttributeValue::S("voting".into()))
        .expression_attribute_values(":name", AttributeValue::S(name.to_string()))
        .send()
        .await?;
    Ok(collect(q.items)?.into_iter().next())
}

fn collect(
    items: Option<Vec<std::collections::HashMap<String, AttributeValue>>>,
) -> Result<Vec<Proposal>, AppError> {
    let mut out = Vec::new();
    for item in items.unwrap_or_default() {
        out.push(proposal_from_item(&item)?);
    }
    Ok(out)
}
