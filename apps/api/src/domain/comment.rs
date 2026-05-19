use ammonia::clean;
use serde::Serialize;

use crate::error::AppError;

/// A comment's user-supplied body, sanitised on construction.
///
/// Centralised here so create + edit paths share one validator. ammonia strips
/// dangerous HTML (script tags, on* attributes, javascript:/data: URLs); the
/// front-end double-sanitises with rehype-sanitize on render.
#[derive(Debug, Clone, Serialize)]
pub struct Body(String);

impl Body {
    pub fn parse(raw: impl Into<String>) -> Result<Self, AppError> {
        let raw: String = raw.into();
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(AppError::BadRequest("comment body must not be empty".into()));
        }
        if trimmed.len() > 10_000 {
            return Err(AppError::BadRequest(
                "comment body must be 10000 characters or fewer".into(),
            ));
        }
        let sanitised = clean(trimmed);
        if sanitised.trim().is_empty() {
            return Err(AppError::BadRequest(
                "comment body becomes empty after sanitisation".into(),
            ));
        }
        Ok(Self(sanitised))
    }

    pub fn into_inner(self) -> String {
        self.0
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_rejected() {
        assert!(matches!(Body::parse(""), Err(AppError::BadRequest(_))));
        assert!(matches!(Body::parse("   "), Err(AppError::BadRequest(_))));
    }

    #[test]
    fn over_length_rejected() {
        let huge = "a".repeat(10_001);
        assert!(matches!(Body::parse(huge), Err(AppError::BadRequest(_))));
    }

    #[test]
    fn plain_text_preserved() {
        let b = Body::parse("hello world").unwrap();
        assert_eq!(b.as_str(), "hello world");
    }

    #[test]
    fn script_tag_stripped() {
        let b = Body::parse("hi <script>alert(1)</script> there").unwrap();
        let s = b.as_str();
        assert!(!s.contains("<script"), "script tag survived: {s}");
        assert!(!s.contains("alert(1)"), "script body survived: {s}");
    }

    #[test]
    fn onclick_stripped() {
        let b = Body::parse(r#"<a href="https://x" onclick="bad()">link</a>"#).unwrap();
        let s = b.as_str();
        assert!(!s.contains("onclick"), "onclick attribute survived: {s}");
    }

    #[test]
    fn javascript_url_stripped() {
        let b = Body::parse(r#"<a href="javascript:alert(1)">click</a>"#).unwrap();
        let s = b.as_str();
        assert!(!s.to_lowercase().contains("javascript:"), "js: url survived: {s}");
    }

    #[test]
    fn markdown_preserved_as_text() {
        // ammonia only sanitises HTML; markdown stays as plain characters for
        // the FE renderer to handle.
        let b = Body::parse("**bold** and *italic*\n\n- one\n- two").unwrap();
        assert!(b.as_str().contains("**bold**"));
        assert!(b.as_str().contains("- one"));
    }

    #[test]
    fn becoming_empty_after_strip_is_rejected() {
        // A body that is only dangerous HTML strips to empty.
        let result = Body::parse("<script>x</script>");
        assert!(matches!(result, Err(AppError::BadRequest(_))));
    }
}
