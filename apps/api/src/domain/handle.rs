//! Validation for user @handles. A handle is a unique, case-insensitive,
//! mention-friendly identifier (`@marina`). Stored lowercased.

use crate::error::AppError;

pub const MIN_LEN: usize = 3;
pub const MAX_LEN: usize = 20;

const RESERVED: &[&str] = &[
    "admin",
    "all",
    "bot",
    "everyone",
    "help",
    "here",
    "me",
    "mod",
    "moderator",
    "root",
    "staff",
    "support",
    "system",
    "vozcoletiva",
];

/// Validate + normalise a handle: trimmed, lowercased, `[a-z0-9_]`, starts with
/// a letter, 3..=20 chars, not reserved. Returns the canonical (lowercase) form.
pub fn validate_handle(raw: &str) -> Result<String, AppError> {
    let h = raw.trim().to_lowercase();
    let len = h.chars().count();
    if !(MIN_LEN..=MAX_LEN).contains(&len) {
        return Err(AppError::BadRequest(format!(
            "handle must be {MIN_LEN} to {MAX_LEN} characters"
        )));
    }
    if !h.starts_with(|c: char| c.is_ascii_lowercase()) {
        return Err(AppError::BadRequest("handle must start with a letter".into()));
    }
    if !h
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return Err(AppError::BadRequest(
            "handle may only contain a-z, 0-9, and '_'".into(),
        ));
    }
    if RESERVED.contains(&h.as_str()) {
        return Err(AppError::BadRequest("handle is reserved".into()));
    }
    Ok(h)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_handles_normalise_to_lowercase() {
        assert_eq!(validate_handle("Marina").unwrap(), "marina");
        assert_eq!(validate_handle("  tomas_42 ").unwrap(), "tomas_42");
        assert_eq!(validate_handle("abc").unwrap(), "abc");
    }

    #[test]
    fn length_bounds_enforced() {
        assert!(matches!(validate_handle("ab"), Err(AppError::BadRequest(_))));
        assert!(matches!(
            validate_handle(&"a".repeat(21)),
            Err(AppError::BadRequest(_))
        ));
    }

    #[test]
    fn must_start_with_letter() {
        assert!(matches!(validate_handle("1abc"), Err(AppError::BadRequest(_))));
        assert!(matches!(validate_handle("_abc"), Err(AppError::BadRequest(_))));
    }

    #[test]
    fn charset_enforced() {
        assert!(matches!(validate_handle("ab-c"), Err(AppError::BadRequest(_))));
        assert!(matches!(validate_handle("ab.c"), Err(AppError::BadRequest(_))));
        assert!(matches!(validate_handle("ab c"), Err(AppError::BadRequest(_))));
    }

    #[test]
    fn reserved_rejected() {
        for r in ["admin", "me", "Everyone", "SYSTEM"] {
            assert!(matches!(validate_handle(r), Err(AppError::BadRequest(_))), "reserved: {r}");
        }
    }
}
