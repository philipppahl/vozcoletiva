use crate::error::AppError;

/// Max category (topic) name length, matching the mock layer.
pub const NAME_MAX: usize = 30;

/// Validate + normalise a category name: trimmed, non-empty, ≤ 30 chars.
pub fn validate_name(raw: &str) -> Result<String, AppError> {
    let name = raw.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("name is required".into()));
    }
    if name.chars().count() > NAME_MAX {
        return Err(AppError::BadRequest(format!(
            "name must be {NAME_MAX} characters or fewer"
        )));
    }
    Ok(name.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trims_and_accepts() {
        assert_eq!(validate_name("  Housing  ").unwrap(), "Housing");
    }

    #[test]
    fn empty_or_whitespace_rejected() {
        assert!(validate_name("").is_err());
        assert!(validate_name("   ").is_err());
    }

    #[test]
    fn boundary_thirty_ok_thirtyone_rejected() {
        let thirty = "a".repeat(30);
        let thirtyone = "a".repeat(31);
        assert_eq!(validate_name(&thirty).unwrap(), thirty);
        assert!(validate_name(&thirtyone).is_err());
    }
}
