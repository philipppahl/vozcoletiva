use crate::error::AppError;

/// Max channel name length.
pub const NAME_MAX: usize = 30;

/// Validate + normalise a channel name: trimmed, non-empty, ≤ 30 chars.
pub fn validate_name(raw: &str) -> Result<String, AppError> {
    let name = raw.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("channel name is required".into()));
    }
    if name.chars().count() > NAME_MAX {
        return Err(AppError::BadRequest(format!(
            "channel name must be {NAME_MAX} characters or fewer"
        )));
    }
    Ok(name.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trims_and_accepts() {
        assert_eq!(validate_name("  design  ").unwrap(), "design");
    }

    #[test]
    fn empty_or_whitespace_rejected() {
        assert!(validate_name("   ").is_err());
        assert!(validate_name("").is_err());
    }

    #[test]
    fn too_long_rejected() {
        assert!(validate_name(&"x".repeat(NAME_MAX + 1)).is_err());
        assert!(validate_name(&"x".repeat(NAME_MAX)).is_ok());
    }
}
