use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// What a voter chose. `None` means they retracted their vote.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Choice {
    Yes,
    No,
    Abstain,
}

impl Choice {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Yes => "yes",
            Self::No => "no",
            Self::Abstain => "abstain",
        }
    }
}

impl std::str::FromStr for Choice {
    type Err = AppError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "yes" => Ok(Self::Yes),
            "no" => Ok(Self::No),
            "abstain" => Ok(Self::Abstain),
            other => Err(AppError::BadRequest(format!("unknown choice: {other}"))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn round_trip() {
        for c in [Choice::Yes, Choice::No, Choice::Abstain] {
            assert_eq!(Choice::from_str(c.as_str()).unwrap(), c);
        }
    }
}
