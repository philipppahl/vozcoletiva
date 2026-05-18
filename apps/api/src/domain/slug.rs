use serde::{Deserialize, Serialize};
use std::fmt;

use crate::error::AppError;

/// URL-friendly project identifier. Globally unique within the instance.
///
/// Rules:
///   * 3..=32 characters
///   * `[a-z0-9-]+`
///   * Does not start or end with `-`
///   * Not a reserved word
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub struct Slug(String);

const RESERVED: &[&str] = &[
    "_",
    "admin",
    "api",
    "app",
    "auth",
    "billing",
    "docs",
    "help",
    "i",
    "join",
    "me",
    "p",
    "projects",
    "settings",
    "sign-in",
    "sign-out",
    "sign-up",
    "static",
    "support",
    "v1",
    "www",
];

impl Slug {
    pub fn parse(s: impl Into<String>) -> Result<Self, AppError> {
        let s: String = s.into();
        let len = s.len();
        if !(3..=32).contains(&len) {
            return Err(AppError::BadRequest(
                "slug must be 3 to 32 characters".into(),
            ));
        }
        if s.starts_with('-') || s.ends_with('-') {
            return Err(AppError::BadRequest(
                "slug must not start or end with '-'".into(),
            ));
        }
        if !s
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        {
            return Err(AppError::BadRequest(
                "slug may only contain a-z, 0-9, and '-'".into(),
            ));
        }
        if RESERVED.iter().any(|r| *r == s) {
            return Err(AppError::BadRequest("slug is reserved".into()));
        }
        Ok(Self(s))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for Slug {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for Slug {
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let raw = String::deserialize(d)?;
        Slug::parse(raw).map_err(serde::de::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_slugs_pass() {
        for s in [
            "abc",
            "my-co-op",
            "abc-123",
            "x".repeat(32).as_str(),
            "team42",
        ] {
            assert!(Slug::parse(s).is_ok(), "expected ok: {s}");
        }
    }

    #[test]
    fn too_short_rejected() {
        assert!(matches!(
            Slug::parse("ab"),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn too_long_rejected() {
        assert!(matches!(
            Slug::parse("a".repeat(33)),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn uppercase_rejected() {
        assert!(matches!(
            Slug::parse("MyCoop"),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn leading_or_trailing_dash_rejected() {
        assert!(matches!(Slug::parse("-foo"), Err(AppError::BadRequest(_))));
        assert!(matches!(Slug::parse("foo-"), Err(AppError::BadRequest(_))));
    }

    #[test]
    fn underscore_rejected() {
        assert!(matches!(Slug::parse("a_b"), Err(AppError::BadRequest(_))));
    }

    #[test]
    fn reserved_rejected() {
        for r in ["api", "app", "p", "join", "sign-in", "v1"] {
            assert!(
                matches!(Slug::parse(r), Err(AppError::BadRequest(_))),
                "expected reserved: {r}",
            );
        }
    }
}
