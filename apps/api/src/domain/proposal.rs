use serde::{Deserialize, Serialize};

use crate::domain::voting_mode::VotingMode;
use crate::error::AppError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProposalStatus {
    Voting,
    Passed,
    Rejected,
    QuorumFailed,
    Withdrawn,
}

impl ProposalStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Voting => "voting",
            Self::Passed => "passed",
            Self::Rejected => "rejected",
            Self::QuorumFailed => "quorum_failed",
            Self::Withdrawn => "withdrawn",
        }
    }

    pub fn is_terminal(&self) -> bool {
        !matches!(self, Self::Voting)
    }
}

impl std::str::FromStr for ProposalStatus {
    type Err = AppError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "voting" => Ok(Self::Voting),
            "passed" => Ok(Self::Passed),
            "rejected" => Ok(Self::Rejected),
            "quorum_failed" => Ok(Self::QuorumFailed),
            "withdrawn" => Ok(Self::Withdrawn),
            other => Err(AppError::BadRequest(format!("unknown status: {other}"))),
        }
    }
}

/// The tally counters that travel with a proposal head item. Updated atomically
/// with each vote write.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct Tally {
    pub yes: i64,
    pub no: i64,
    pub abstain: i64,
}

impl Tally {
    pub fn voter_count(&self) -> i64 {
        self.yes + self.no + self.abstain
    }
}

/// Compute a terminal status from a tally + voting rule. Pure function: no
/// side effects, no I/O. Tested in isolation.
pub fn compute_outcome(
    tally: Tally,
    mode: VotingMode,
    quorum: Option<i64>,
) -> ProposalStatus {
    if let Some(q) = quorum {
        if tally.voter_count() < q {
            return ProposalStatus::QuorumFailed;
        }
    }
    match mode {
        VotingMode::SimpleMajority => {
            if tally.yes > tally.no {
                ProposalStatus::Passed
            } else {
                ProposalStatus::Rejected
            }
        }
        VotingMode::QualifiedTwoThirds => {
            let decisive = tally.yes + tally.no;
            // Threshold: yes * 3 >= 2 * (yes + no), avoiding floats.
            if decisive == 0 {
                ProposalStatus::Rejected
            } else if tally.yes * 3 >= 2 * decisive {
                ProposalStatus::Passed
            } else {
                ProposalStatus::Rejected
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(y: i64, n: i64, a: i64) -> Tally {
        Tally { yes: y, no: n, abstain: a }
    }

    #[test]
    fn simple_majority_yes_wins() {
        assert_eq!(
            compute_outcome(t(3, 1, 0), VotingMode::SimpleMajority, None),
            ProposalStatus::Passed,
        );
    }

    #[test]
    fn simple_majority_tie_is_rejected() {
        assert_eq!(
            compute_outcome(t(2, 2, 0), VotingMode::SimpleMajority, None),
            ProposalStatus::Rejected,
        );
    }

    #[test]
    fn simple_majority_no_wins() {
        assert_eq!(
            compute_outcome(t(1, 3, 0), VotingMode::SimpleMajority, None),
            ProposalStatus::Rejected,
        );
    }

    #[test]
    fn simple_majority_ignores_abstain() {
        assert_eq!(
            compute_outcome(t(2, 1, 100), VotingMode::SimpleMajority, None),
            ProposalStatus::Passed,
        );
    }

    #[test]
    fn two_thirds_exact_passes() {
        // 2 yes / 3 decisive == 66.6% → yes*3 (6) >= 2*decisive (6) → pass
        assert_eq!(
            compute_outcome(t(2, 1, 0), VotingMode::QualifiedTwoThirds, None),
            ProposalStatus::Passed,
        );
    }

    #[test]
    fn two_thirds_just_below_fails() {
        // 1 yes / 2 decisive == 50% → fails
        assert_eq!(
            compute_outcome(t(1, 1, 0), VotingMode::QualifiedTwoThirds, None),
            ProposalStatus::Rejected,
        );
    }

    #[test]
    fn two_thirds_all_abstain_is_rejected() {
        assert_eq!(
            compute_outcome(t(0, 0, 5), VotingMode::QualifiedTwoThirds, None),
            ProposalStatus::Rejected,
        );
    }

    #[test]
    fn quorum_failed_when_below() {
        assert_eq!(
            compute_outcome(t(3, 0, 0), VotingMode::SimpleMajority, Some(5)),
            ProposalStatus::QuorumFailed,
        );
    }

    #[test]
    fn quorum_includes_abstain() {
        // Quorum counts everyone who voted, including abstain.
        assert_eq!(
            compute_outcome(t(2, 0, 3), VotingMode::SimpleMajority, Some(5)),
            ProposalStatus::Passed,
        );
    }
}
