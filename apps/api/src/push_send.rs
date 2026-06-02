//! Web Push delivery (decision 0025 Phase B). Encrypts a payload per RFC 8291
//! (aes128gcm) with a VAPID signature via `web-push-native`, and POSTs it to the
//! subscription endpoint (FCM / Mozilla / Apple) with reqwest.
//!
//! The encryption is pure-Rust (RustCrypto + `superboring`), so this
//! cross-compiles to the arm64 Lambda without a C toolchain.

use base64ct::{Base64UrlUnpadded, Encoding};
use serde::Serialize;
use thiserror::Error;
use web_push_native::jwt_simple::algorithms::ES256KeyPair;
use web_push_native::{p256::PublicKey, Auth, WebPushBuilder};

use crate::repo::push::PushSubscription;

/// The JSON the service worker's `push` handler reads (`{ title, body, tag?, url }`).
/// `body` may contain message/comment text (PII): it is encrypted to the
/// recipient's subscription and never logged.
#[derive(Debug, Clone, Serialize)]
pub struct PushContent {
    pub title: String,
    pub body: String,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
    /// Sender/actor avatar URL → the notification's large icon (the SW falls
    /// back to the app icon when absent).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

impl PushContent {
    pub fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap_or_default()
    }
}

#[derive(Debug, Error)]
pub enum PushError {
    #[error("invalid VAPID private key")]
    BadVapidKey,
    #[error("invalid subscription key material")]
    BadSubKey,
    #[error("invalid subscription endpoint")]
    BadEndpoint,
    #[error("payload encryption failed: {0}")]
    Encrypt(String),
    #[error("transport error: {0}")]
    Http(String),
    #[error("push service rejected: {0}")]
    Rejected(u16),
}

/// What the push service said about a single send.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SendOutcome {
    Delivered,
    /// 404/410 — the subscription is dead and should be pruned.
    Gone,
}

/// A loaded VAPID identity, reusable across sends. Built once at cold start.
pub struct Vapid {
    key_pair: ES256KeyPair,
    contact: String,
}

impl Vapid {
    /// Build from the base64url-unpadded 32-byte private scalar (SSM) and the
    /// RFC 8292 contact (`mailto:` / `https:`).
    pub fn new(private_key_b64url: &str, contact: String) -> Result<Self, PushError> {
        let raw = decode_b64url(private_key_b64url)?;
        let key_pair = ES256KeyPair::from_bytes(&raw).map_err(|_| PushError::BadVapidKey)?;
        Ok(Self { key_pair, contact })
    }
}

fn decode_b64url(s: &str) -> Result<Vec<u8>, PushError> {
    // Browsers emit unpadded base64url for subscription keys; be lenient about
    // any padding a client might add.
    Base64UrlUnpadded::decode_vec(s.trim_end_matches('=')).map_err(|_| PushError::BadSubKey)
}

/// Encrypt + send `payload` to one subscription. Returns `Gone` for a dead
/// endpoint (caller prunes), `Delivered` on success, or an error otherwise.
pub async fn send(
    http: &reqwest::Client,
    vapid: &Vapid,
    sub: &PushSubscription,
    payload: &[u8],
) -> Result<SendOutcome, PushError> {
    let p256dh = PublicKey::from_sec1_bytes(&decode_b64url(&sub.p256dh)?)
        .map_err(|_| PushError::BadSubKey)?;
    let auth_bytes = decode_b64url(&sub.auth)?;
    if auth_bytes.len() != 16 {
        return Err(PushError::BadSubKey); // Auth is a 16-byte secret (GenericArray<u8, U16>)
    }
    let auth = Auth::clone_from_slice(&auth_bytes);
    let endpoint = sub.endpoint.parse().map_err(|_| PushError::BadEndpoint)?;

    let request = WebPushBuilder::new(endpoint, p256dh, auth)
        .with_vapid(&vapid.key_pair, &vapid.contact)
        .build(payload.to_vec())
        .map_err(|e| PushError::Encrypt(e.to_string()))?;

    // http::Request → reqwest: copy method, uri, headers, encrypted body.
    let (parts, body) = request.into_parts();
    let mut rb = http.request(parts.method, parts.uri.to_string());
    for (name, value) in parts.headers.iter() {
        rb = rb.header(name.as_str(), value.as_bytes());
    }
    let resp = rb
        .body(body)
        .send()
        .await
        .map_err(|e| PushError::Http(e.to_string()))?;

    let status = resp.status();
    if status == reqwest::StatusCode::NOT_FOUND || status == reqwest::StatusCode::GONE {
        Ok(SendOutcome::Gone)
    } else if status.is_success() {
        Ok(SendOutcome::Delivered)
    } else {
        Err(PushError::Rejected(status.as_u16()))
    }
}
