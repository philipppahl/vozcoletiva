use std::collections::HashSet;

use crate::domain::outcome::{decide_outcome, OutcomeStatus};
use crate::domain::proposal::ProposalStatus;
use crate::error::AppError;
use crate::repo::proposal;
use crate::state::AppState;

/// Close a deliberation: read the whole tree, decide the outcome from the root's
/// materialised tally + rule + quorum, and transition every voting node
/// atomically — winner → passed, other alternatives → rejected, all →
/// quorum_failed when quorum fails. Idempotent: returns `Ok(false)` if already
/// terminal.
pub async fn close(
    state: &AppState,
    project_id: &str,
    proposal_id: &str,
) -> Result<bool, AppError> {
    let prop = proposal::get(state, project_id, proposal_id).await?;
    if prop.status.is_terminal() {
        tracing::info!(
            event = "proposal_close_skipped_terminal",
            proposal_id = %proposal_id,
            status = %prop.status.as_str(),
        );
        return Ok(false);
    }

    // The deliberation's nodes (root + forks). Falls back to the proposal itself
    // for any legacy root that predates the GSI2 tree index.
    let mut nodes = proposal::tree(state, &prop.root_id).await?;
    if nodes.is_empty() {
        nodes.push(prop.clone());
    }
    let root = nodes
        .iter()
        .find(|n| n.id == prop.root_id)
        .unwrap_or(&nodes[0]);

    let valid_ids: HashSet<String> = nodes.iter().map(|n| n.id.clone()).collect();
    let outcome = decide_outcome(&valid_ids, &root.tally, root.voting_rule, root.quorum);

    // Per-node terminal status. Only still-`voting` nodes are transitioned;
    // already-terminal nodes (e.g. a withdrawn fork) keep their status.
    let transitions: Vec<(String, ProposalStatus)> = nodes
        .iter()
        .filter(|n| !n.status.is_terminal())
        .map(|n| {
            let status = match outcome.status {
                OutcomeStatus::QuorumFailed => ProposalStatus::QuorumFailed,
                OutcomeStatus::HasWinner if outcome.winner_id.as_deref() == Some(n.id.as_str()) => {
                    ProposalStatus::Passed
                }
                OutcomeStatus::HasWinner | OutcomeStatus::NoWinner => ProposalStatus::Rejected,
            };
            (n.id.clone(), status)
        })
        .collect();

    if transitions.is_empty() {
        return Ok(false);
    }
    proposal::transition_tree_to_terminal(state, &prop.project_id, &transitions).await?;

    // Counts only — never the per-user choice (PII).
    tracing::info!(
        event = "proposal_closed",
        proposal_id = %proposal_id,
        root_id = %root.id,
        node_count = nodes.len(),
        has_winner = outcome.winner_id.is_some(),
        tally_decisive = root.tally.decisive(),
        tally_none = root.tally.none,
        tally_abstain = root.tally.abstain,
    );
    Ok(true)
}
