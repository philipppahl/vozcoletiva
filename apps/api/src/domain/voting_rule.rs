use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// The rule applied at close-time to decide a deliberation's winner.
///
/// Mirrors the four rules in the mock layer + decision 0005:
/// plurality / simple_majority / two_thirds / consensus. The winner is the
/// leading alternative subject to the rule's threshold; "none of these" competes
/// against the alternatives. See `crate::domain::outcome::decide_outcome`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VotingRule {
    /// Most-picked alternative wins; a tie (with the runner-up or with "none")
    /// is no winner.
    Plurality,
    /// The leading alternative must take more than half of the decisive votes.
    SimpleMajority,
    /// The leading alternative must take at least two-thirds of the decisive votes.
    TwoThirds,
    /// Everyone who voted decisively must converge on a single alternative
    /// (no other alternative, no "none of these"). Abstain is silence-as-consent.
    Consensus,
}

impl VotingRule {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Plurality => "plurality",
            Self::SimpleMajority => "simple_majority",
            Self::TwoThirds => "two_thirds",
            Self::Consensus => "consensus",
        }
    }
}

impl std::str::FromStr for VotingRule {
    type Err = AppError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "plurality" => Ok(Self::Plurality),
            "simple_majority" => Ok(Self::SimpleMajority),
            "two_thirds" => Ok(Self::TwoThirds),
            "consensus" => Ok(Self::Consensus),
            other => Err(AppError::BadRequest(format!(
                "unknown voting rule: {other}"
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
        for r in [
            VotingRule::Plurality,
            VotingRule::SimpleMajority,
            VotingRule::TwoThirds,
            VotingRule::Consensus,
        ] {
            assert_eq!(VotingRule::from_str(r.as_str()).unwrap(), r);
        }
    }

    #[test]
    fn unknown_rule_rejected() {
        assert!(VotingRule::from_str("qualified_two_thirds").is_err());
    }
}
