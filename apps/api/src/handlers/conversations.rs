use chrono::Utc;
use lambda_http::{Body, Error, Request, Response};
use serde::{Deserialize, Serialize};

use crate::auth::{bearer_token, perms, AuthenticatedUser};
use crate::domain::message::validate_body;
use crate::error::AppError;
use crate::repo::conversation::Conversation;
use crate::repo::message::Message;
use crate::repo::{conversation, membership, message};
use crate::state::AppState;

const PAGE_LIMIT: usize = 50;

#[derive(Debug, Serialize)]
struct LastMessage {
    author_display_name: String,
    body_preview: String,
    at: String,
}

#[derive(Debug, Serialize)]
struct ChannelView {
    kind: &'static str,
    id: String,
    project_id: String,
    name: String,
    description: Option<String>,
    member_count: i64,
    last_message: Option<LastMessage>,
    unread_count: i64,
}

#[derive(Debug, Serialize)]
struct ChannelListResponse {
    channels: Vec<ChannelView>,
}

#[derive(Debug, Serialize)]
struct MessageView {
    id: String,
    conversation_id: String,
    parent_message_id: Option<String>,
    author_id: String,
    author_display_name: String,
    body: String,
    attachments: Vec<serde_json::Value>,
    created_at: String,
    edited_at: Option<String>,
    reply_count: i64,
    last_reply_at: Option<String>,
}

#[derive(Debug, Serialize)]
struct MessageListResponse {
    messages: Vec<MessageView>,
    has_more: bool,
}

#[derive(Debug, Serialize)]
struct ThreadResponse {
    parent: MessageView,
    replies: Vec<MessageView>,
}

#[derive(Debug, Deserialize)]
struct PostMessageBody {
    body: String,
    parent_message_id: Option<String>,
    #[serde(default)]
    attachments: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct ReadBody {
    message_id: String,
}

fn preview(body: &str) -> String {
    body.chars().take(80).collect()
}

fn message_view(m: &Message) -> MessageView {
    MessageView {
        id: m.id.clone(),
        conversation_id: m.conversation_id.clone(),
        parent_message_id: m.parent_message_id.clone(),
        author_id: m.author_id.clone(),
        author_display_name: m.author_display_name.clone(),
        body: m.body.clone(),
        attachments: Vec::new(),
        created_at: m.created_at.clone(),
        edited_at: None,
        reply_count: m.reply_count,
        last_reply_at: m.last_reply_at.clone(),
    }
}

async fn channel_view(
    state: &AppState,
    user_id: &str,
    c: Conversation,
    member_count: i64,
) -> Result<ChannelView, AppError> {
    let marker = conversation::conversation_read(state, user_id, &c.id).await?;
    let unread = message::unread_count(state, &c.id, marker.as_deref()).await?;
    let last = message::last_message(state, &c.id)
        .await?
        .map(|m| LastMessage {
            author_display_name: m.author_display_name,
            body_preview: preview(&m.body),
            at: m.created_at,
        });
    Ok(ChannelView {
        kind: "channel",
        id: c.id,
        project_id: c.project_id,
        name: c.name,
        description: c.description,
        member_count,
        last_message: last,
        unread_count: unread,
    })
}

/// The caller's membership in a conversation's project, or Forbidden.
async fn member_of(
    state: &AppState,
    project_id: &str,
    user_id: &str,
) -> Result<membership::Membership, AppError> {
    match membership::get(state, project_id, user_id).await {
        Ok(m) => Ok(m),
        Err(AppError::NotFound) => Err(AppError::Forbidden("not a member of this project".into())),
        Err(e) => Err(e),
    }
}

pub async fn list_channels(
    state: &AppState,
    req: Request,
    slug: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let auth = perms::require_member(state, &user, slug).await?;
            let member_count = membership::list(state, &auth.project.id).await?.len() as i64;
            let channels = conversation::list_channels(state, &auth.project.id).await?;
            let mut views = Vec::with_capacity(channels.len());
            for c in channels {
                views.push(channel_view(state, &user.user_id, c, member_count).await?);
            }
            Ok(ChannelListResponse { channels: views })
        },
        200,
    )
    .await
}

pub async fn get_conversation(
    state: &AppState,
    req: Request,
    id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let conv = conversation::get(state, id).await?;
            member_of(state, &conv.project_id, &user.user_id).await?;
            let member_count = membership::list(state, &conv.project_id).await?.len() as i64;
            channel_view(state, &user.user_id, conv, member_count).await
        },
        200,
    )
    .await
}

pub async fn list_messages(
    state: &AppState,
    req: Request,
    id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let conv = conversation::get(state, id).await?;
            member_of(state, &conv.project_id, &user.user_id).await?;
            let before = query_param(&req, "before");
            let (messages, has_more) =
                message::list_top_level(state, &conv.id, before.as_deref(), PAGE_LIMIT).await?;
            Ok(MessageListResponse {
                messages: messages.iter().map(message_view).collect(),
                has_more,
            })
        },
        200,
    )
    .await
}

pub async fn post_message(
    state: &AppState,
    req: Request,
    id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let conv = conversation::get(state, id).await?;
            let me = member_of(state, &conv.project_id, &user.user_id).await?;
            let body: PostMessageBody = parse_body(&req)?;
            if !body.attachments.is_empty() {
                return Err(AppError::BadRequest(
                    "attachments are not supported yet".into(),
                ));
            }
            let text = validate_body(&body.body)?;

            if let Some(parent_id) = body.parent_message_id.as_deref() {
                // The parent must be a top-level message in this conversation.
                let parent = match message::top_level_by_id(state, parent_id).await {
                    Ok(p) => p,
                    Err(AppError::NotFound) => {
                        return Err(AppError::BadRequest(
                            "parent must be a top-level message in this conversation".into(),
                        ))
                    }
                    Err(e) => return Err(e),
                };
                if parent.conversation_id != conv.id {
                    return Err(AppError::BadRequest(
                        "parent message is not in this conversation".into(),
                    ));
                }
            }

            let msg = message::post(
                state,
                &conv.id,
                &user.user_id,
                &me.display_name,
                &text,
                body.parent_message_id.as_deref(),
            )
            .await?;

            // Counts only — chat content is PII and is never logged.
            tracing::info!(
                event = "message_posted",
                project_id = %conv.project_id,
                conversation_id = %conv.id,
                has_parent = body.parent_message_id.is_some(),
                by_user = %user.user_id,
            );
            Ok(message_view(&msg))
        },
        201,
    )
    .await
}

pub async fn mark_read(state: &AppState, req: Request, id: &str) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let conv = conversation::get(state, id).await?;
            member_of(state, &conv.project_id, &user.user_id).await?;
            let body: ReadBody = parse_body(&req)?;
            conversation::set_conversation_read(
                state,
                &user.user_id,
                &conv.id,
                &body.message_id,
                &Utc::now().to_rfc3339(),
            )
            .await?;
            Ok(serde_json::json!({ "ok": true }))
        },
        200,
    )
    .await
}

pub async fn get_thread(
    state: &AppState,
    req: Request,
    message_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let parent = message::top_level_by_id(state, message_id).await?;
            let conv = conversation::get(state, &parent.conversation_id).await?;
            member_of(state, &conv.project_id, &user.user_id).await?;
            let replies = message::thread_replies(state, &parent.id).await?;
            Ok(ThreadResponse {
                parent: message_view(&parent),
                replies: replies.iter().map(message_view).collect(),
            })
        },
        200,
    )
    .await
}

pub async fn mark_thread_read(
    state: &AppState,
    req: Request,
    parent_id: &str,
) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let parent = message::top_level_by_id(state, parent_id).await?;
            let conv = conversation::get(state, &parent.conversation_id).await?;
            member_of(state, &conv.project_id, &user.user_id).await?;
            let body: ReadBody = parse_body(&req)?;
            conversation::set_thread_read(
                state,
                &user.user_id,
                &parent.id,
                &body.message_id,
                &Utc::now().to_rfc3339(),
            )
            .await?;
            Ok(serde_json::json!({ "ok": true }))
        },
        200,
    )
    .await
}

async fn authenticate(state: &AppState, req: &Request) -> Result<AuthenticatedUser, AppError> {
    let token = bearer_token(req)?;
    state.jwt.verify(token).await
}

fn query_param(req: &Request, key: &str) -> Option<String> {
    req.uri().query().and_then(|q| url_param(q, key))
}

fn url_param(query: &str, key: &str) -> Option<String> {
    for pair in query.split('&') {
        let mut it = pair.splitn(2, '=');
        if it.next() == Some(key) {
            return it.next().map(|v| v.to_string());
        }
    }
    None
}

fn parse_body<T: for<'de> Deserialize<'de>>(req: &Request) -> Result<T, AppError> {
    let bytes = match req.body() {
        Body::Text(s) => s.as_bytes().to_vec(),
        Body::Binary(b) => b.clone(),
        Body::Empty => Vec::new(),
    };
    serde_json::from_slice(&bytes)
        .map_err(|e| AppError::BadRequest(format!("invalid JSON body: {e}")))
}
