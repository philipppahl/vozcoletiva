use thiserror::Error;

/// Project-wide error taxonomy. Expands as features land — for the foundation slice
/// it carries only the variants the hello path may surface, plus a catch-all.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("internal server error")]
    Internal(#[from] Box<dyn std::error::Error + Send + Sync>),
}

impl AppError {
    #[allow(dead_code)]
    pub fn status(&self) -> u16 {
        match self {
            Self::Internal(_) => 500,
        }
    }
}
