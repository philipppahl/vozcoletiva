use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// What a proposal produces. A `Document` proposal, when passed, becomes a
/// version of the document named by `document_name` (decision 0004).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProposalKind {
    Decision,
    Document,
}

impl ProposalKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Decision => "decision",
            Self::Document => "document",
        }
    }
}

impl std::str::FromStr for ProposalKind {
    type Err = AppError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "decision" => Ok(Self::Decision),
            "document" => Ok(Self::Document),
            other => Err(AppError::BadRequest(format!(
                "unknown proposal kind: {other}"
            ))),
        }
    }
}

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

/// The materialised per-deliberation tally. Lives as map/counter attributes on
/// the root proposal head and is updated atomically with each vote write.
///
/// `by_choice[proposalId]` = number of users who picked that alternative;
/// `none` = "none of these"; `abstain` = present-but-not-decisive.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Tally {
    pub by_choice: HashMap<String, i64>,
    pub none: i64,
    pub abstain: i64,
}

impl Tally {
    /// Votes that count toward a winner: every alternative pick plus "none of
    /// these". Abstain is excluded.
    pub fn decisive(&self) -> i64 {
        self.by_choice.values().sum::<i64>() + self.none
    }

    /// Everyone who cast a vote, including abstainers.
    pub fn total(&self) -> i64 {
        self.decisive() + self.abstain
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn proposal_kind_round_trip() {
        for k in [ProposalKind::Decision, ProposalKind::Document] {
            assert_eq!(ProposalKind::from_str(k.as_str()).unwrap(), k);
        }
        assert!(ProposalKind::from_str("petition").is_err());
    }
}
