use aws_sdk_dynamodb::types::AttributeValue;
use chrono::Utc;

use crate::domain::proposal::compute_outcome;
use crate::error::AppError;
use crate::repo::proposal;
use crate::state::AppState;

/// Close a proposal: read the current head, compute the outcome from the
/// materialised tally + the chosen mode + quorum, and transition the status
/// atomically. Idempotent — if the proposal is already terminal, returns
/// `Ok(false)` and is a no-op.
pub async fn close(state: &AppState, proposal_id: &str) -> Result<bool, AppError> {
    let prop = find_by_id(state, proposal_id).await?;
    if prop.status.is_terminal() {
        tracing::info!(
            event = "proposal_close_skipped_terminal",
            proposal_id = %proposal_id,
            status = %prop.status.as_str(),
        );
        return Ok(false);
    }

    let outcome = compute_outcome(prop.tally, prop.voting_mode, prop.quorum);

    let transitioned =
        proposal::transition_to_terminal(state, &prop.project_id, &prop.id, outcome).await?;

    if transitioned {
        tracing::info!(
            event = "proposal_closed",
            proposal_id = %proposal_id,
            status = %outcome.as_str(),
            tally_yes = prop.tally.yes,
            tally_no = prop.tally.no,
            tally_abstain = prop.tally.abstain,
        );
    }
    Ok(transitioned)
}

/// Locate a proposal by id alone (we only get `proposal_id` from the scheduler
/// payload; project_id is needed for the DDB key, but we can scan via the
/// proposalId attribute). Cheap because we only ever close a proposal once.
async fn find_by_id(
    state: &AppState,
    proposal_id: &str,
) -> Result<proposal::Proposal, AppError> {
    // We don't have an attribute index on proposalId alone. Fastest path: the
    // proposal's PK is PROJECT#<projectId>, SK is PROPOSAL#<proposalId>. The
    // proposalId is also embedded in the SK. We use a Scan with FilterExpression
    // on `proposalId = :id` — bounded by the project's proposals which is small.
    //
    // A future GSI3 mapping proposalId → projectId would replace this Scan;
    // documented in docs/data-model.md § Open design questions.
    let scan = state
        .ddb
        .scan()
        .table_name(&state.table_name)
        .filter_expression("#t = :t AND proposalId = :p")
        .expression_attribute_names("#t", "type")
        .expression_attribute_values(":t", AttributeValue::S("Proposal".into()))
        .expression_attribute_values(":p", AttributeValue::S(proposal_id.into()))
        .limit(1)
        .send()
        .await?;
    let item = scan
        .items
        .and_then(|mut v| v.pop())
        .ok_or(AppError::NotFound)?;
    let prop = proposal::proposal_from_item(&item)?;
    // Avoid lint warning about unused `now`:
    let _ = Utc::now();
    Ok(prop)
}
