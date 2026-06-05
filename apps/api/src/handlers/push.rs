use chrono::Utc;
use lambda_http::{Body, Error, Request, Response};
use serde::{Deserialize, Serialize};

use crate::auth::{bearer_token, AuthenticatedUser};
use crate::error::AppError;
use crate::repo::push::{self, NotificationPrefs};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct SubscriptionKeys {
    p256dh: String,
    auth: String,
}

#[derive(Debug, Deserialize)]
struct SubscribeBody {
    endpoint: String,
    keys: SubscriptionKeys,
    /// A fresh device's per-kind prefs; omit for all-on (decision 0035).
    #[serde(default)]
    prefs: Option<NotificationPrefs>,
}

#[derive(Debug, Deserialize)]
struct UnsubscribeBody {
    endpoint: String,
}

#[derive(Debug, Deserialize)]
struct UpdatePrefsBody {
    endpoint: String,
    prefs: NotificationPrefs,
}

#[derive(Debug, Serialize)]
struct SubscriptionView {
    endpoint: String,
    prefs: NotificationPrefs,
    created_at: String,
}

#[derive(Debug, Serialize)]
struct SubscriptionListResponse {
    subscriptions: Vec<SubscriptionView>,
}

/// `POST /v1/me/push-subscriptions` — register this browser's push subscription
/// (with optional per-device prefs; defaults all-on). Idempotent upsert.
pub async fn subscribe(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let body: SubscribeBody = parse_body(&req)?;
            let ua = req
                .headers()
                .get("user-agent")
                .and_then(|v| v.to_str().ok());
            let prefs = body.prefs.unwrap_or_default();
            let now = Utc::now().to_rfc3339();
            push::add_subscription(
                state,
                &user.user_id,
                &push::NewSubscription {
                    endpoint: &body.endpoint,
                    p256dh: &body.keys.p256dh,
                    auth: &body.keys.auth,
                    user_agent: ua,
                    prefs: &prefs,
                },
                &now,
            )
            .await?;
            tracing::info!(event = "push_subscription_added", user_id = %user.user_id);
            Ok(SubscriptionView {
                endpoint: body.endpoint,
                prefs,
                created_at: now,
            })
        },
        201,
    )
    .await
}

/// `POST /v1/me/push-subscriptions/remove` — drop a subscription (opt-out /
/// expired).
pub async fn unsubscribe(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let body: UnsubscribeBody = parse_body(&req)?;
            push::delete_subscription(state, &user.user_id, &body.endpoint).await?;
            Ok(serde_json::json!({ "ok": true }))
        },
        200,
    )
    .await
}

/// `GET /v1/me/push-subscriptions` — the caller's subscriptions with per-device
/// prefs, so the settings screen can find *this* device by its local endpoint.
pub async fn list(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let subs = push::list_subscriptions(state, &user.user_id).await?;
            Ok(SubscriptionListResponse {
                subscriptions: subs
                    .into_iter()
                    .map(|s| SubscriptionView {
                        endpoint: s.endpoint,
                        prefs: s.prefs,
                        created_at: s.created_at,
                    })
                    .collect(),
            })
        },
        200,
    )
    .await
}

/// `PUT /v1/me/push-subscriptions/prefs` — set this device's per-kind prefs
/// (decision 0035). 404 if the endpoint isn't a registered subscription.
pub async fn update_prefs(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let body: UpdatePrefsBody = parse_body(&req)?;
            push::update_subscription_prefs(state, &user.user_id, &body.endpoint, &body.prefs)
                .await?;
            Ok(body.prefs)
        },
        200,
    )
    .await
}

async fn authenticate(state: &AppState, req: &Request) -> Result<AuthenticatedUser, AppError> {
    let token = bearer_token(req)?;
    state.jwt.verify(token).await
}

fn parse_body<T: for<'de> Deserialize<'de>>(req: &Request) -> Result<T, AppError> {
    serde_json::from_slice(req.body().as_ref())
        .map_err(|e| AppError::BadRequest(format!("invalid request body: {e}")))
}
