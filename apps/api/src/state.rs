use std::sync::Arc;

use aws_sdk_dynamodb::Client as DdbClient;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_scheduler::Client as SchedulerClient;

use crate::auth::jwt::JwtVerifier;
use crate::scheduler::SchedulerConfig;

/// Media (avatars) configuration. `base_url` builds a public CDN URL from an
/// object key; `bucket` + `s3` are present only where the context writes media
/// (the API), absent where it only reads URLs (the stream consumer).
#[derive(Clone)]
pub struct MediaConfig {
    pub base_url: String,
    pub bucket: Option<String>,
    pub s3: Option<Arc<S3Client>>,
}

impl MediaConfig {
    /// The public URL for a stored object key (`avatars/<uid>/<ver>.webp`).
    pub fn url_for(&self, key: &str) -> String {
        format!("{}/{}", self.base_url.trim_end_matches('/'), key)
    }
}

/// Per-process state passed into every handler. Built once at Lambda cold start.
#[derive(Clone)]
pub struct AppState {
    pub ddb: Arc<DdbClient>,
    pub jwt: Arc<JwtVerifier>,
    pub table_name: String,
    pub scheduler: Option<Arc<SchedulerConfig>>,
    pub media: Option<MediaConfig>,
}

impl AppState {
    /// Build an `AppState` around an already-configured DynamoDB client, with a
    /// stub JWT verifier and no scheduler. For DynamoDB-Local integration tests.
    #[cfg(feature = "test-support")]
    pub fn for_test(ddb: DdbClient, table_name: String) -> Self {
        Self {
            ddb: Arc::new(ddb),
            jwt: Arc::new(crate::auth::jwt::JwtVerifier::stub()),
            table_name,
            scheduler: None,
            media: None,
        }
    }

    /// Build an `AppState` for a context that never verifies tokens — the
    /// realtime stream consumer. Reuses an already-loaded SDK config (the bin
    /// also needs it for the API-Gateway management client) and skips the JWKS
    /// fetch entirely, so cold start doesn't depend on Cognito being reachable.
    pub fn for_stream(aws_config: &aws_config::SdkConfig, table_name: String) -> Self {
        // The consumer only needs the base URL to build avatar links for push.
        let media = std::env::var("MEDIA_BASE_URL")
            .ok()
            .map(|base_url| MediaConfig {
                base_url,
                bucket: None,
                s3: None,
            });
        Self {
            ddb: Arc::new(DdbClient::new(aws_config)),
            jwt: Arc::new(JwtVerifier::offline()),
            table_name,
            scheduler: None,
            media,
        }
    }

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

        // Scheduler is optional — the worker Lambda doesn't need it (and doesn't
        // have IAM perms for it). Configured iff all three env vars are present.
        let scheduler = match (
            std::env::var("SCHEDULER_GROUP_NAME"),
            std::env::var("WORKER_FUNCTION_ARN"),
            std::env::var("SCHEDULER_INVOKE_ROLE_ARN"),
        ) {
            (Ok(group_name), Ok(worker_arn), Ok(invoke_role_arn)) => {
                Some(Arc::new(SchedulerConfig {
                    client: SchedulerClient::new(&aws_config),
                    group_name,
                    worker_arn,
                    invoke_role_arn,
                }))
            }
            _ => None,
        };

        // Media: present iff both the bucket + base URL are configured.
        let media = match (
            std::env::var("MEDIA_BUCKET"),
            std::env::var("MEDIA_BASE_URL"),
        ) {
            (Ok(bucket), Ok(base_url)) => Some(MediaConfig {
                base_url,
                bucket: Some(bucket),
                s3: Some(Arc::new(S3Client::new(&aws_config))),
            }),
            _ => None,
        };

        Ok(Self {
            ddb: Arc::new(DdbClient::new(&aws_config)),
            jwt: Arc::new(jwt),
            table_name,
            scheduler,
            media,
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
