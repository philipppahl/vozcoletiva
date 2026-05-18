use std::sync::Arc;

use aws_sdk_dynamodb::Client as DdbClient;

use crate::auth::jwt::JwtVerifier;

/// Per-process state passed into every handler. Built once at Lambda cold start.
#[derive(Clone)]
pub struct AppState {
    pub ddb: Arc<DdbClient>,
    pub jwt: Arc<JwtVerifier>,
    pub table_name: String,
}

impl AppState {
    pub async fn from_env() -> Result<Self, BootError> {
        let aws_config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;

        let region = std::env::var("AWS_REGION").unwrap_or_else(|_| "eu-west-1".to_string());
        let user_pool_id =
            std::env::var("USER_POOL_ID").map_err(|_| BootError::MissingEnv("USER_POOL_ID"))?;
        let client_id = std::env::var("USER_POOL_CLIENT_ID")
            .map_err(|_| BootError::MissingEnv("USER_POOL_CLIENT_ID"))?;
        let table_name =
            std::env::var("TABLE_NAME").map_err(|_| BootError::MissingEnv("TABLE_NAME"))?;

        let issuer = format!("https://cognito-idp.{region}.amazonaws.com/{user_pool_id}");
        let jwks_url = format!("{issuer}/.well-known/jwks.json");

        let jwt = JwtVerifier::new(jwks_url, issuer, client_id).await?;

        Ok(Self {
            ddb: Arc::new(DdbClient::new(&aws_config)),
            jwt: Arc::new(jwt),
            table_name,
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum BootError {
    #[error("missing env var: {0}")]
    MissingEnv(&'static str),

    #[error("jwt verifier init: {0}")]
    JwtInit(#[from] crate::auth::jwt::JwksError),
}
