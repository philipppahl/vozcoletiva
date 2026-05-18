use crate::domain::proposal::compute_outcome;
use crate::error::AppError;
use crate::repo::proposal;
use crate::state::AppState;

/// Close a proposal: read the head, compute the outcome from the materialised
/// tally + mode + quorum, transition the status atomically. Idempotent —
/// returns `Ok(false)` if the proposal is already terminal.
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
