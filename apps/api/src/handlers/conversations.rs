use chrono::Utc;
use lambda_http::{Body, Error, Request, Response};
use serde::{Deserialize, Serialize};

use crate::auth::{bearer_token, perms, AuthenticatedUser};
use crate::domain::message::validate_body;
use crate::error::AppError;
use crate::repo::conversation::{Conversation, ConversationMeta, DmConversation};
use crate::repo::message::{Attachment, Message};
use crate::repo::{conversation, membership, message, user};
use crate::state::{AppState, MediaConfig};

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
struct DmParticipantView {
    user_id: String,
    display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    handle: Option<String>,
    avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
struct DmView {
    kind: &'static str,
    id: String,
    participants: Vec<DmParticipantView>,
    last_message: Option<LastMessage>,
    unread_count: i64,
}

#[derive(Debug, Serialize)]
struct DmListResponse {
    dms: Vec<DmView>,
}

#[derive(Debug, Deserialize)]
struct StartDmBody {
    user_id: String,
}

#[derive(Debug, Serialize)]
struct AttachmentView {
    kind: String,
    url: String,
    mime: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    size: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    width: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    height: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration_ms: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct AttachmentInput {
    kind: String,
    key: String,
    #[serde(default)]
    mime: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    size: Option<i64>,
    #[serde(default)]
    width: Option<i64>,
    #[serde(default)]
    height: Option<i64>,
    #[serde(default)]
    duration_ms: Option<i64>,
}

#[derive(Debug, Serialize)]
struct MessageView {
    id: String,
    conversation_id: String,
    parent_message_id: Option<String>,
    author_id: String,
    author_display_name: String,
    body: String,
    attachments: Vec<AttachmentView>,
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
    attachments: Vec<AttachmentInput>,
}

const ALLOWED_KINDS: [&str; 3] = ["image", "doc", "voice"];
const MAX_ATTACHMENTS: usize = 10;

/// Validate + convert incoming attachment refs to stored attachments. The key
/// must be one we issued (under `chat/`); kinds are constrained. The bytes were
/// uploaded via a server-issued presigned PUT, so we trust the metadata.
fn to_attachments(input: Vec<AttachmentInput>) -> Result<Vec<Attachment>, AppError> {
    if input.len() > MAX_ATTACHMENTS {
        return Err(AppError::BadRequest("too many attachments".into()));
    }
    input
        .into_iter()
        .map(|a| {
            if !ALLOWED_KINDS.contains(&a.kind.as_str()) {
                return Err(AppError::BadRequest("unknown attachment kind".into()));
            }
            if !a.key.starts_with("chat/") || a.key.contains("..") {
                return Err(AppError::BadRequest("invalid attachment key".into()));
            }
            Ok(Attachment {
                kind: a.kind,
                key: a.key,
                mime: a.mime,
                name: a.name,
                size: a.size,
                width: a.width,
                height: a.height,
                duration_ms: a.duration_ms,
            })
        })
        .collect()
}

#[derive(Debug, Deserialize)]
struct ReadBody {
    message_id: String,
}

fn preview(body: &str) -> String {
    body.chars().take(80).collect()
}

fn message_view(m: &Message, media: Option<&MediaConfig>) -> MessageView {
    let attachments = m
        .attachments
        .iter()
        .map(|a| AttachmentView {
            kind: a.kind.clone(),
            url: media.map(|cfg| cfg.url_for(&a.key)).unwrap_or_default(),
            mime: a.mime.clone(),
            name: a.name.clone(),
            size: a.size,
            width: a.width,
            height: a.height,
            duration_ms: a.duration_ms,
        })
        .collect();
    MessageView {
        id: m.id.clone(),
        conversation_id: m.conversation_id.clone(),
        parent_message_id: m.parent_message_id.clone(),
        author_id: m.author_id.clone(),
        author_display_name: m.author_display_name.clone(),
        body: m.body.clone(),
        attachments,
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

async fn dm_view(
    state: &AppState,
    viewer_id: &str,
    dm: DmConversation,
) -> Result<DmView, AppError> {
    let mut participants = Vec::with_capacity(2);
    for uid in &dm.participant_ids {
        let profile = user::get_profile(state, uid).await?;
        let display_name = profile
            .as_ref()
            .map(|p| p.display_name.clone())
            .unwrap_or_else(|| uid.clone());
        let avatar_url = state
            .media
            .as_ref()
            .zip(profile.as_ref().and_then(|p| p.avatar_key.as_ref()))
            .map(|(cfg, key)| cfg.url_for(key));
        participants.push(DmParticipantView {
            user_id: uid.clone(),
            display_name,
            handle: profile.as_ref().and_then(|p| p.handle.clone()),
            avatar_url,
        });
    }
    let marker = conversation::conversation_read(state, viewer_id, &dm.id).await?;
    let unread = message::unread_count(state, &dm.id, marker.as_deref()).await?;
    let last = message::last_message(state, &dm.id)
        .await?
        .map(|m| LastMessage {
            author_display_name: m.author_display_name,
            body_preview: preview(&m.body),
            at: m.created_at,
        });
    Ok(DmView {
        kind: "dm",
        id: dm.id,
        participants,
        last_message: last,
        unread_count: unread,
    })
}

/// Authorize a read/write against a conversation: channel → project member;
/// DM → one of the two participants. Forbidden otherwise.
async fn authorize_conversation(
    state: &AppState,
    meta: &ConversationMeta,
    user_id: &str,
) -> Result<(), AppError> {
    match meta {
        ConversationMeta::Channel(c) => {
            member_of(state, &c.project_id, user_id).await?;
            Ok(())
        }
        ConversationMeta::Dm(d) => {
            if d.participant_ids.iter().any(|p| p == user_id) {
                Ok(())
            } else {
                Err(AppError::Forbidden(
                    "not a participant of this conversation".into(),
                ))
            }
        }
    }
}

/// The display name to stamp on a posted message: a channel uses the poster's
/// project-membership name; a DM uses their profile name (no project context).
async fn poster_display_name(
    state: &AppState,
    meta: &ConversationMeta,
    user_id: &str,
) -> Result<String, AppError> {
    match meta {
        ConversationMeta::Channel(c) => {
            Ok(member_of(state, &c.project_id, user_id).await?.display_name)
        }
        ConversationMeta::Dm(_) => Ok(user::get_or_create_profile(state, user_id, user_id)
            .await?
            .display_name),
    }
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
            let meta = conversation::get_meta(state, id).await?;
            authorize_conversation(state, &meta, &user.user_id).await?;
            // Channels and DMs serialise to different shapes (discriminated by
            // `kind`); the FE's Conversation union handles both.
            match meta {
                ConversationMeta::Channel(c) => {
                    let member_count = membership::list(state, &c.project_id).await?.len() as i64;
                    let view = channel_view(state, &user.user_id, c, member_count).await?;
                    serde_json::to_value(view).map_err(|e| AppError::Internal(Box::new(e)))
                }
                ConversationMeta::Dm(d) => {
                    let view = dm_view(state, &user.user_id, d).await?;
                    serde_json::to_value(view).map_err(|e| AppError::Internal(Box::new(e)))
                }
            }
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
            let meta = conversation::get_meta(state, id).await?;
            authorize_conversation(state, &meta, &user.user_id).await?;
            let before = query_param(&req, "before");
            let (messages, has_more) =
                message::list_top_level(state, meta.id(), before.as_deref(), PAGE_LIMIT).await?;
            let media = state.media.as_ref();
            Ok(MessageListResponse {
                messages: messages.iter().map(|m| message_view(m, media)).collect(),
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
            let meta = conversation::get_meta(state, id).await?;
            authorize_conversation(state, &meta, &user.user_id).await?;
            let author_name = poster_display_name(state, &meta, &user.user_id).await?;
            let conv_id = meta.id().to_string();
            let body: PostMessageBody = parse_body(&req)?;
            let attachments = to_attachments(body.attachments)?;
            // A message must carry text or at least one attachment.
            let text = if body.body.trim().is_empty() && !attachments.is_empty() {
                String::new()
            } else {
                validate_body(&body.body)?
            };

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
                if parent.conversation_id != conv_id {
                    return Err(AppError::BadRequest(
                        "parent message is not in this conversation".into(),
                    ));
                }
            }

            let msg = message::post(
                state,
                &conv_id,
                &user.user_id,
                &author_name,
                &text,
                body.parent_message_id.as_deref(),
                attachments,
            )
            .await?;

            // Counts only — chat content is PII and is never logged.
            tracing::info!(
                event = "message_posted",
                conversation_kind = match &meta {
                    ConversationMeta::Channel(_) => "channel",
                    ConversationMeta::Dm(_) => "dm",
                },
                conversation_id = %conv_id,
                has_parent = body.parent_message_id.is_some(),
                by_user = %user.user_id,
            );
            // Best-effort notifications — never fail the post.
            if let Err(e) =
                crate::notify::message_posted(state, &meta, &msg, &Utc::now().to_rfc3339()).await
            {
                tracing::warn!(event = "inbox_fanout_failed", trigger = "message", error = %e);
            }
            Ok(message_view(&msg, state.media.as_ref()))
        },
        201,
    )
    .await
}

pub async fn mark_read(state: &AppState, req: Request, id: &str) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let meta = conversation::get_meta(state, id).await?;
            authorize_conversation(state, &meta, &user.user_id).await?;
            let body: ReadBody = parse_body(&req)?;
            conversation::set_conversation_read(
                state,
                &user.user_id,
                meta.id(),
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
            let meta = conversation::get_meta(state, &parent.conversation_id).await?;
            authorize_conversation(state, &meta, &user.user_id).await?;
            let replies = message::thread_replies(state, &parent.id).await?;
            let media = state.media.as_ref();
            Ok(ThreadResponse {
                parent: message_view(&parent, media),
                replies: replies.iter().map(|m| message_view(m, media)).collect(),
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
            let meta = conversation::get_meta(state, &parent.conversation_id).await?;
            authorize_conversation(state, &meta, &user.user_id).await?;
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

pub async fn list_dms(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let pointers = conversation::list_dms(state, &user.user_id).await?;
            let mut dms = Vec::with_capacity(pointers.len());
            for p in pointers {
                let dm = DmConversation {
                    id: p.conversation_id,
                    participant_ids: conversation::dm_pair(&user.user_id, &p.peer_id),
                    created_at: p.created_at,
                };
                dms.push(dm_view(state, &user.user_id, dm).await?);
            }
            // Most recent activity first (no last message → fall back to id).
            dms.sort_by(|a, b| {
                let a_at = a
                    .last_message
                    .as_ref()
                    .map(|m| m.at.as_str())
                    .unwrap_or(&a.id);
                let b_at = b
                    .last_message
                    .as_ref()
                    .map(|m| m.at.as_str())
                    .unwrap_or(&b.id);
                b_at.cmp(a_at)
            });
            Ok(DmListResponse { dms })
        },
        200,
    )
    .await
}

pub async fn create_dm(state: &AppState, req: Request) -> Result<Response<Body>, Error> {
    super::json_or_error(
        async {
            let user = authenticate(state, &req).await?;
            let body: StartDmBody = parse_body(&req)?;
            if body.user_id == user.user_id {
                return Err(AppError::BadRequest("cannot DM yourself".into()));
            }
            // The peer must be a real user (have a profile). This also stops
            // dm_view from materialising a UUID-named profile for a bad id.
            if user::get_profile(state, &body.user_id).await?.is_none() {
                return Err(AppError::NotFound);
            }
            let dm = conversation::create_or_get_dm(
                state,
                &user.user_id,
                &body.user_id,
                &Utc::now().to_rfc3339(),
            )
            .await?;
            tracing::info!(
                event = "dm_created",
                conversation_id = %dm.id,
                by_user = %user.user_id,
                peer_user = %body.user_id,
            );
            dm_view(state, &user.user_id, dm).await
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
