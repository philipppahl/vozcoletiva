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
}

#[derive(Debug, Deserialize)]
struct UnsubscribeBody {
    endpoint: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct PrefsDto {
    push_enabled: bool,
    mention: bool,
    reply: bool,
    comment_on_yours: bool,
    proposal_closed: bool,
    document_amended: bool,
    // Defaulted so a client that PUTs an older payload (pre-DM-pref) keeps DMs on
    // rather than silently muting them.
    #[serde(default = "default_true")]
    direct_message: bool,
}

fn default_true() -> bool {
    true
}

impl From<NotificationPrefs> for PrefsDto {
    fn from(p: NotificationPrefs) -> Self {
        Self {
            push_enabled: p.push_enabled,
            mention: p.mention,
            reply: p.reply,
            comment_on_yours: p.comment_on_yours,
            proposal_closed: p.proposal_closed,
            document_amended: p.document_amended,
            direct_message: p.direct_message,
        }
    }
}

impl From<PrefsDto> for NotificationPrefs {
    fn from(d: PrefsDto) -> Self {
        Self {
            push_enabled: d.push_enabled,
            mention: d.mention,
            reply: d.reply,
            comment_on_yours: d.comment_on_yours,
            proposal_closed: d.proposal_closed,
            document_amended: d.document_amended,
            direct_message: d.direct_message,
        }
    }
}

/// `POST /v1/me/push-subscriptions` — register a browser push subscription.
pub async fn subscribe(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let body: SubscribeBody = parse_body(&req)?;
            let ua = req
                .headers()
                .get("user-agent")
                .and_then(|v| v.to_str().ok());
            push::add_subscription(
                state,
                &user.user_id,
                &body.endpoint,
                &body.keys.p256dh,
                &body.keys.auth,
                ua,
                &Utc::now().to_rfc3339(),
            )
            .await?;
            tracing::info!(event = "push_subscription_added", user_id = %user.user_id);
            Ok(serde_json::json!({ "ok": true }))
        },
        201,
    )
    .await
}

/// `POST /v1/me/push-subscriptions/remove` — drop a subscription (on opt-out or
/// when the browser reports it expired).
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

/// `GET /v1/me/notification-prefs`
pub async fn get_prefs(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let prefs = push::get_prefs(state, &user.user_id).await?;
            Ok(PrefsDto::from(prefs))
        },
        200,
    )
    .await
}

/// `PUT /v1/me/notification-prefs`
pub async fn put_prefs(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let dto: PrefsDto = parse_body(&req)?;
            let prefs: NotificationPrefs = dto.into();
            push::put_prefs(state, &user.user_id, &prefs).await?;
            Ok(PrefsDto::from(prefs))
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
