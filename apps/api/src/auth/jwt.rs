use std::collections::HashMap;

use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;
use thiserror::Error;
use tokio::sync::RwLock;

use crate::auth::AuthenticatedUser;
use crate::error::AppError;

/// Cognito access-token claims we care about. `iss` is validated by
/// `jsonwebtoken` but kept on the struct for symmetry / debugging.
#[derive(Debug, Deserialize)]
struct AccessClaims {
    sub: String,
    #[allow(dead_code)]
    iss: String,
    client_id: String,
    token_use: String,
    exp: i64,
}

#[derive(Debug, Deserialize)]
struct Jwks {
    keys: Vec<Jwk>,
}

#[derive(Debug, Clone, Deserialize)]
struct Jwk {
    kid: String,
    n: String,
    e: String,
    #[allow(dead_code)]
    alg: Option<String>,
    #[allow(dead_code)]
    kty: String,
    #[allow(dead_code)]
    #[serde(rename = "use")]
    key_use: Option<String>,
}

#[derive(Debug, Error)]
pub enum JwksError {
    #[error("fetching JWKS: {0}")]
    Fetch(#[from] reqwest::Error),
    #[error("parsing JWKS: {0}")]
    Parse(String),
}

/// Verifies Cognito access tokens. Holds a cached JWKS keyed by `kid`. Refreshes
/// on cache-miss (a new key rotation), not on every call.
pub struct JwtVerifier {
    jwks_url: String,
    expected_iss: String,
    expected_client_id: String,
    keys: RwLock<HashMap<String, DecodingKey>>,
}

impl JwtVerifier {
    pub async fn new(
        jwks_url: String,
        expected_iss: String,
        expected_client_id: String,
    ) -> Result<Self, JwksError> {
        let v = Self {
            jwks_url,
            expected_iss,
            expected_client_id,
            keys: RwLock::new(HashMap::new()),
        };
        v.refresh_keys().await?;
        Ok(v)
    }

    /// A verifier that holds no keys and contacts nothing. For tests that need an
    /// `AppState` but never call `verify` (e.g. repo-layer integration tests).
    #[cfg(feature = "test-support")]
    pub fn stub() -> Self {
        Self::empty()
    }

    /// A verifier that holds no keys and contacts nothing, for runtime contexts
    /// that never call `verify` (the realtime stream consumer). Distinct from
    /// the test-only `stub()` so it ships in release builds.
    pub fn offline() -> Self {
        Self::empty()
    }

    fn empty() -> Self {
        Self {
            jwks_url: String::new(),
            expected_iss: String::new(),
            expected_client_id: String::new(),
            keys: RwLock::new(HashMap::new()),
        }
    }

    async fn refresh_keys(&self) -> Result<(), JwksError> {
        let body = reqwest::get(&self.jwks_url).await?.error_for_status()?;
        let jwks: Jwks = body.json().await?;
        let mut keys = self.keys.write().await;
        keys.clear();
        for k in jwks.keys {
            let key = DecodingKey::from_rsa_components(&k.n, &k.e)
                .map_err(|e| JwksError::Parse(e.to_string()))?;
            keys.insert(k.kid, key);
        }
        Ok(())
    }

    async fn key_for(&self, kid: &str) -> Result<DecodingKey, AppError> {
        {
            if let Some(k) = self.keys.read().await.get(kid) {
                return Ok(k.clone());
            }
        }
        // Cache miss → try one refresh in case of key rotation.
        self.refresh_keys().await.map_err(|e| match e {
            JwksError::Fetch(err) => AppError::Internal(Box::new(err)),
            JwksError::Parse(msg) => AppError::Internal(Box::new(std::io::Error::other(msg))),
        })?;
        self.keys
            .read()
            .await
            .get(kid)
            .cloned()
            .ok_or_else(|| AppError::Unauthorized("unknown JWKS kid".into()))
    }

    /// Verify a Cognito access token. Returns the authenticated user on success.
    pub async fn verify(&self, token: &str) -> Result<AuthenticatedUser, AppError> {
        let header = decode_header(token)
            .map_err(|e| AppError::Unauthorized(format!("malformed token: {e}")))?;
        let kid = header
            .kid
            .ok_or_else(|| AppError::Unauthorized("token missing 'kid'".into()))?;
        let key = self.key_for(&kid).await?;

        // We hand-validate `client_id` and `token_use` after decoding because
        // Cognito access tokens do not carry an `aud` claim — `client_id` is
        // the equivalent. jsonwebtoken's built-in `set_audience` only applies
        // to `aud`, so we skip it here and check manually.
        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_issuer(&[&self.expected_iss]);
        validation.validate_exp = true;
        validation.validate_nbf = false;
        validation.required_spec_claims.clear();
        validation.required_spec_claims.insert("exp".into());
        validation.required_spec_claims.insert("iss".into());

        let data = decode::<AccessClaims>(token, &key, &validation)?;
        let claims = data.claims;

        if claims.client_id != self.expected_client_id {
            return Err(AppError::Unauthorized(
                "token client_id does not match expected app client".into(),
            ));
        }
        if claims.token_use != "access" {
            return Err(AppError::Unauthorized(format!(
                "token_use must be 'access', got '{}'",
                claims.token_use
            )));
        }
        let now = chrono::Utc::now().timestamp();
        if claims.exp < now {
            return Err(AppError::Unauthorized("token expired".into()));
        }

        Ok(AuthenticatedUser {
            user_id: claims.sub,
        })
    }
}
