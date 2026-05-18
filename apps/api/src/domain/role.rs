use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

use crate::error::AppError;

/// Project membership roles in privilege order. Higher rank = more privileged.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Owner,
    Admin,
    Moderator,
    Member,
    Observer,
}

impl Role {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Owner => "owner",
            Self::Admin => "admin",
            Self::Moderator => "moderator",
            Self::Member => "member",
            Self::Observer => "observer",
        }
    }

    pub fn rank(&self) -> u8 {
        match self {
            Self::Owner => 5,
            Self::Admin => 4,
            Self::Moderator => 3,
            Self::Member => 2,
            Self::Observer => 1,
        }
    }

    pub fn is_admin_or_above(&self) -> bool {
        self.rank() >= Self::Admin.rank()
    }

    /// Roles an invite may grant. We deliberately exclude Owner (created on
    /// project creation only) and Admin/Moderator (not surfaced in MVP UI).
    pub fn invitable() -> &'static [Role] {
        &[Role::Member, Role::Observer]
    }
}

impl fmt::Display for Role {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for Role {
    type Err = AppError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "owner" => Ok(Self::Owner),
            "admin" => Ok(Self::Admin),
            "moderator" => Ok(Self::Moderator),
            "member" => Ok(Self::Member),
            "observer" => Ok(Self::Observer),
            other => Err(AppError::BadRequest(format!("unknown role: {other}"))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roles_round_trip_via_string() {
        for r in [
            Role::Owner,
            Role::Admin,
            Role::Moderator,
            Role::Member,
            Role::Observer,
        ] {
            assert_eq!(Role::from_str(r.as_str()).unwrap(), r);
        }
    }

    #[test]
    fn owner_outranks_member() {
        assert!(Role::Owner.rank() > Role::Member.rank());
        assert!(Role::Admin.is_admin_or_above());
        assert!(Role::Owner.is_admin_or_above());
        assert!(!Role::Member.is_admin_or_above());
    }

    #[test]
    fn unknown_role_is_bad_request() {
        let err = Role::from_str("god-king").unwrap_err();
        assert!(matches!(err, AppError::BadRequest(_)));
    }

    #[test]
    fn invitable_excludes_owner_and_above() {
        let invitable = Role::invitable();
        assert!(!invitable.contains(&Role::Owner));
        assert!(!invitable.contains(&Role::Admin));
        assert!(!invitable.contains(&Role::Moderator));
        assert!(invitable.contains(&Role::Member));
        assert!(invitable.contains(&Role::Observer));
    }
}
