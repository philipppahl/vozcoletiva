//! Validation for user-chosen display names.
//!
//! The display name is the single source of truth for how a user is shown
//! across the app (members, comments, message authors). Cognito holds auth
//! only — see decision 0019.

use crate::error::AppError;

/// Max display-name length, in characters. Matches the OpenAPI bound.
pub const MAX_LEN: usize = 80;

/// Validate + normalise a display name: trims surrounding whitespace, strips
/// control characters (newlines, tabs, …), and enforces a non-empty, ≤80-char
/// result. Accents and emoji are preserved.
pub fn validate_display_name(raw: &str) -> Result<String, AppError> {
    let cleaned: String = raw.trim().chars().filter(|c| !c.is_control()).collect();
    if cleaned.is_empty() {
        return Err(AppError::BadRequest(
            "display name must not be empty".into(),
        ));
    }
    if cleaned.chars().count() > MAX_LEN {
        return Err(AppError::BadRequest(format!(
            "display name must be at most {MAX_LEN} characters"
        )));
    }
    Ok(cleaned)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trims_surrounding_whitespace() {
        assert_eq!(validate_display_name("  Marina Alves  ").unwrap(), "Marina Alves");
    }

    #[test]
    fn keeps_accents_and_emoji() {
        assert_eq!(validate_display_name("Lúcia 🌱").unwrap(), "Lúcia 🌱");
    }

    #[test]
    fn strips_control_characters() {
        assert_eq!(validate_display_name("Tom\nás\t").unwrap(), "Tomás");
    }

    #[test]
    fn rejects_empty_and_whitespace_only() {
        assert!(validate_display_name("").is_err());
        assert!(validate_display_name("   ").is_err());
        assert!(validate_display_name("\n\t").is_err());
    }

    #[test]
    fn rejects_over_length() {
        let ok = "a".repeat(MAX_LEN);
        assert!(validate_display_name(&ok).is_ok());
        let too_long = "a".repeat(MAX_LEN + 1);
        assert!(validate_display_name(&too_long).is_err());
    }
}
