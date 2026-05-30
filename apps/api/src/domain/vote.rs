use crate::error::AppError;

/// Special wire tokens. Any other value is the picked alternative's proposal id.
pub const VOTE_NONE: &str = "__none__";
pub const VOTE_ABSTAIN: &str = "__abstain__";

/// What a voter chose in a deliberation (one vote per deliberation, keyed on the
/// root). Per decision 0005 the choice is the picked alternative's proposal id,
/// or "none of these", or "abstain". Retraction is the absence of a vote item,
/// not a `Choice` variant.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Choice {
    /// The picked alternative's proposal id.
    Pick(String),
    /// "None of these" — a decisive vote for no alternative.
    NoneOfThese,
    /// Abstain — present but not decisive.
    Abstain,
}

impl Choice {
    /// The wire / storage form: the proposal id, or one of the special tokens.
    pub fn wire(&self) -> &str {
        match self {
            Self::Pick(id) => id,
            Self::NoneOfThese => VOTE_NONE,
            Self::Abstain => VOTE_ABSTAIN,
        }
    }

    /// The picked alternative's id, if this is a `Pick`.
    pub fn picked_id(&self) -> Option<&str> {
        match self {
            Self::Pick(id) => Some(id),
            _ => None,
        }
    }
}

impl std::str::FromStr for Choice {
    type Err = AppError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "" => Err(AppError::BadRequest("choice must not be empty".into())),
            VOTE_NONE => Ok(Self::NoneOfThese),
            VOTE_ABSTAIN => Ok(Self::Abstain),
            id => Ok(Self::Pick(id.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn round_trip() {
        let cases = [
            Choice::Pick("01HZZZ".to_string()),
            Choice::NoneOfThese,
            Choice::Abstain,
        ];
        for c in cases {
            assert_eq!(Choice::from_str(c.wire()).unwrap(), c);
        }
    }

    #[test]
    fn tokens_map_to_variants() {
        assert_eq!(Choice::from_str("__none__").unwrap(), Choice::NoneOfThese);
        assert_eq!(Choice::from_str("__abstain__").unwrap(), Choice::Abstain);
        assert_eq!(
            Choice::from_str("01HABC").unwrap(),
            Choice::Pick("01HABC".to_string())
        );
    }

    #[test]
    fn empty_rejected() {
        assert!(Choice::from_str("").is_err());
    }

    #[test]
    fn picked_id_only_for_pick() {
        assert_eq!(Choice::Pick("x".into()).picked_id(), Some("x"));
        assert_eq!(Choice::NoneOfThese.picked_id(), None);
        assert_eq!(Choice::Abstain.picked_id(), None);
    }
}
