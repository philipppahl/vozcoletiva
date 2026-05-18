use lambda_http::{Request, RequestExt};

use crate::error::AppError;

pub mod jwt;

/// Identity established by a verified Cognito access token.
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: String,
}

/// Extract the bearer token from an incoming request's `Authorization` header.
/// Returns `Unauthorized` if missing or malformed.
pub fn bearer_token(req: &Request) -> Result<&str, AppError> {
    let value = req
        .headers()
        .get("authorization")
        .or_else(|| req.headers().get("Authorization"))
        .ok_or_else(|| AppError::Unauthorized("missing authorization header".into()))?
        .to_str()
        .map_err(|_| AppError::Unauthorized("authorization header is not valid utf-8".into()))?;

    let token = value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))
        .ok_or_else(|| AppError::Unauthorized("authorization scheme must be 'Bearer'".into()))?;

    if token.is_empty() {
        return Err(AppError::Unauthorized("empty bearer token".into()));
    }

    Ok(token)
}

#[allow(dead_code)]
pub(crate) fn _silence_request_ext_unused(_r: &Request) {
    // RequestExt is in scope for potential future use without an "unused import" lint.
    let _ = _r.request_context();
}

#[cfg(test)]
mod tests {
    use super::*;
    use lambda_http::http::request::Builder;
    use lambda_http::http::Method;
    use lambda_http::Body;

    fn req_with_auth(header: Option<&str>) -> Request {
        let mut builder = Builder::new()
            .method(Method::GET)
            .uri("https://example.com/v1/me");
        if let Some(value) = header {
            builder = builder.header("authorization", value);
        }
        builder.body(Body::Empty).unwrap()
    }

    #[test]
    fn extracts_valid_bearer_token() {
        let req = req_with_auth(Some("Bearer abc123"));
        assert_eq!(bearer_token(&req).unwrap(), "abc123");
    }

    #[test]
    fn accepts_lowercase_bearer_scheme() {
        let req = req_with_auth(Some("bearer abc123"));
        assert_eq!(bearer_token(&req).unwrap(), "abc123");
    }

    #[test]
    fn rejects_missing_header() {
        let req = req_with_auth(None);
        match bearer_token(&req) {
            Err(AppError::Unauthorized(msg)) => assert!(msg.contains("missing")),
            other => panic!("expected Unauthorized, got {other:?}"),
        }
    }

    #[test]
    fn rejects_wrong_scheme() {
        let req = req_with_auth(Some("Basic abc"));
        assert!(matches!(bearer_token(&req), Err(AppError::Unauthorized(_))));
    }

    #[test]
    fn rejects_empty_token() {
        let req = req_with_auth(Some("Bearer "));
        assert!(matches!(bearer_token(&req), Err(AppError::Unauthorized(_))));
    }
}
