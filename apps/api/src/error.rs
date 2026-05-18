use thiserror::Error;

/// Project-wide error taxonomy. Expands as features land. Some variants
/// exist for future use and are flagged dead-code-allowed until the next slice.
#[derive(Debug, Error)]
#[allow(dead_code)]
pub enum AppError {
    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error("not found")]
    NotFound,

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("internal server error")]
    Internal(#[from] anyhow_like::BoxedError),
}

impl AppError {
    pub fn status(&self) -> u16 {
        match self {
            Self::Unauthorized(_) => 401,
            Self::NotFound => 404,
            Self::BadRequest(_) => 400,
            Self::Internal(_) => 500,
        }
    }

    pub fn code(&self) -> &'static str {
        match self {
            Self::Unauthorized(_) => "unauthorized",
            Self::NotFound => "not_found",
            Self::BadRequest(_) => "bad_request",
            Self::Internal(_) => "internal_error",
        }
    }
}

/// Tiny shim so we don't pull anyhow just to carry boxed errors at the boundary.
mod anyhow_like {
    pub type BoxedError = Box<dyn std::error::Error + Send + Sync>;
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(e: jsonwebtoken::errors::Error) -> Self {
        Self::Unauthorized(format!("jwt verification: {e}"))
    }
}

impl From<aws_sdk_dynamodb::Error> for AppError {
    fn from(e: aws_sdk_dynamodb::Error) -> Self {
        Self::Internal(Box::new(e))
    }
}

impl<T: std::error::Error + Send + Sync + 'static>
    From<aws_sdk_dynamodb::error::SdkError<T>> for AppError
{
    fn from(e: aws_sdk_dynamodb::error::SdkError<T>) -> Self {
        Self::Internal(Box::new(e))
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        Self::Internal(Box::new(e))
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        Self::Internal(Box::new(e))
    }
}
