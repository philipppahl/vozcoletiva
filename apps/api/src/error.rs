use thiserror::Error;

/// Project-wide error taxonomy. Expands as features land.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error("forbidden: {0}")]
    Forbidden(String),

    #[error("not found")]
    NotFound,

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("internal server error")]
    Internal(#[from] anyhow_like::BoxedError),
}

impl AppError {
    pub fn status(&self) -> u16 {
        match self {
            Self::Unauthorized(_) => 401,
            Self::Forbidden(_) => 403,
            Self::NotFound => 404,
            Self::Conflict(_) => 409,
            Self::BadRequest(_) => 400,
            Self::Internal(_) => 500,
        }
    }

    pub fn code(&self) -> &'static str {
        match self {
            Self::Unauthorized(_) => "unauthorized",
            Self::Forbidden(_) => "forbidden",
            Self::NotFound => "not_found",
            Self::Conflict(_) => "conflict",
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
