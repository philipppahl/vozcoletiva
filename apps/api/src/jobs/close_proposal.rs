use std::collections::HashSet;

use crate::domain::outcome::{decide_outcome, OutcomeStatus};
use crate::domain::proposal::ProposalStatus;
use crate::error::AppError;
use crate::repo::proposal;
use crate::state::AppState;

/// Close a deliberation: read the root head, decide the outcome from the
/// materialised tally + rule + quorum, transition the status atomically.
/// Idempotent — returns `Ok(false)` if already terminal.
///
/// Slice A: the only candidate is the root, so the valid-id set is `{root}` and
/// the root passes iff it wins. The full tree (winner → passed, losers →
/// rejected across forks/options) arrives with slice B.
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

    let valid_ids: HashSet<String> = std::iter::once(prop.root_id.clone()).collect();
    let outcome = decide_outcome(&valid_ids, &prop.tally, prop.voting_rule, prop.quorum);

    let new_status = match outcome.status {
        OutcomeStatus::QuorumFailed => ProposalStatus::QuorumFailed,
        OutcomeStatus::HasWinner if outcome.winner_id.as_deref() == Some(prop.root_id.as_str()) => {
            ProposalStatus::Passed
        }
        // A non-root winner is unreachable while the tree is root-only (slice A);
        // treat the root as not-passed if it ever happens.
        OutcomeStatus::HasWinner | OutcomeStatus::NoWinner => ProposalStatus::Rejected,
    };

    let transitioned =
        proposal::transition_to_terminal(state, &prop.project_id, &prop.id, new_status).await?;

    if transitioned {
        // Counts only — never the per-user choice (PII).
        tracing::info!(
            event = "proposal_closed",
            proposal_id = %proposal_id,
            status = %new_status.as_str(),
            has_winner = outcome.winner_id.is_some(),
            tally_decisive = prop.tally.decisive(),
            tally_none = prop.tally.none,
            tally_abstain = prop.tally.abstain,
        );
    }
    Ok(transitioned)
}
