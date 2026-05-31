use crate::error::AppError;

/// Max message body length.
pub const BODY_MAX: usize = 4000;

/// Validate + normalise a chat message body: trimmed, non-empty, ≤ 4000 chars.
pub fn validate_body(raw: &str) -> Result<String, AppError> {
    let body = raw.trim();
    if body.is_empty() {
        return Err(AppError::BadRequest("message body is required".into()));
    }
    if body.chars().count() > BODY_MAX {
        return Err(AppError::BadRequest(format!(
            "message must be {BODY_MAX} characters or fewer"
        )));
    }
    Ok(body.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trims_and_accepts() {
        assert_eq!(validate_body("  hello  ").unwrap(), "hello");
    }

    #[test]
    fn empty_or_whitespace_rejected() {
        assert!(validate_body("").is_err());
        assert!(validate_body("   ").is_err());
    }

    #[test]
    fn over_max_rejected() {
        assert!(validate_body(&"a".repeat(BODY_MAX + 1)).is_err());
        assert!(validate_body(&"a".repeat(BODY_MAX)).is_ok());
    }
}
