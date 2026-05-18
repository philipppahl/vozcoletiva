use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Voting rule applied at close-time to the cast votes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VotingMode {
    /// `yes > no`. Abstain doesn't count.
    SimpleMajority,
    /// `yes >= 2 * (yes + no) / 3`. Abstain doesn't count.
    QualifiedTwoThirds,
}

impl VotingMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::SimpleMajority => "simple_majority",
            Self::QualifiedTwoThirds => "qualified_two_thirds",
        }
    }
}

impl std::str::FromStr for VotingMode {
    type Err = AppError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "simple_majority" => Ok(Self::SimpleMajority),
            "qualified_two_thirds" => Ok(Self::QualifiedTwoThirds),
            other => Err(AppError::BadRequest(format!(
                "unknown voting mode: {other}"
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn round_trip_via_string() {
        for m in [
            VotingMode::SimpleMajority,
            VotingMode::QualifiedTwoThirds,
        ] {
            assert_eq!(VotingMode::from_str(m.as_str()).unwrap(), m);
        }
    }
}
