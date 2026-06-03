//! Inbox fan-out on write. Called from the trigger handlers (message + comment
//! create, in the API Lambda) and the close job (in the worker Lambda). Each
//! function computes the entitled recipient set and writes one inbox item each.
//!
//! Callers treat these as **best-effort**: a fan-out failure is logged but must
//! never fail the user's underlying action. See decision 0021.

use std::collections::{HashMap, HashSet};

use crate::domain::proposal::ProposalKind;
use crate::domain::vote::Choice;
use crate::repo::comment::Comment;
use crate::repo::conversation::ConversationMeta;
use crate::repo::inbox::{self, InboxKind, NewInboxItem};
use crate::repo::message::Message;
use crate::repo::project::Project;
use crate::repo::proposal::Proposal;
use crate::repo::{membership, project, user, vote};
use crate::error::AppError;
use crate::state::AppState;

const PREVIEW_LEN: usize = 120;

fn preview(text: &str) -> String {
    let cleaned = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if cleaned.chars().count() <= PREVIEW_LEN {
        return cleaned;
    }
    let truncated: String = cleaned.chars().take(PREVIEW_LEN - 1).collect();
    format!("{}…", truncated.trim_end())
}

const HANDLE_MIN: usize = 3;
const HANDLE_MAX: usize = 20;

fn is_handle_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

/// A `@` starts a mention only at the start of the body or after a non
/// handle-character — so an email's local part (`marina@example.com`) and a URL
/// userinfo (`x@host`) aren't mistaken for one. Mirrors the web client's
/// mention regex.
fn mention_boundary(bytes: &[u8], at: usize) -> bool {
    at == 0 || !is_handle_byte(bytes[at - 1])
}

/// Extract `@handle` mentions (lowercased, deduped) from a message body. A
/// handle is 3–20 `[A-Za-z0-9_]` chars at a mention boundary; the run must end
/// at a non handle-character (an over-long run isn't a valid handle).
fn extract_mentions(body: &str) -> Vec<String> {
    let bytes = body.as_bytes();
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] != b'@' || !mention_boundary(bytes, i) {
            i += 1;
            continue;
        }
        let start = i + 1;
        let mut j = start;
        while j < bytes.len() && is_handle_byte(bytes[j]) {
            j += 1;
        }
        let len = j - start;
        if (HANDLE_MIN..=HANDLE_MAX).contains(&len) {
            let handle = body[start..j].to_ascii_lowercase();
            if seen.insert(handle.clone()) {
                out.push(handle);
            }
        }
        i = if j > start { j } else { i + 1 };
    }
    out
}

/// Replace `@handle` mention tokens with `@<display name>` for the stored
/// preview, so a notification reads "@Marina Alves …" rather than "@marina".
/// Unknown / non-member handles are left as-is. Lookup is case-insensitive;
/// slices on ASCII token boundaries — UTF-8 safe.
fn resolve_mention_names(body: &str, names: &HashMap<String, String>) -> String {
    let bytes = body.as_bytes();
    let mut out = String::with_capacity(body.len());
    let mut last = 0;
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] != b'@' || !mention_boundary(bytes, i) {
            i += 1;
            continue;
        }
        let start = i + 1;
        let mut j = start;
        while j < bytes.len() && is_handle_byte(bytes[j]) {
            j += 1;
        }
        let len = j - start;
        if (HANDLE_MIN..=HANDLE_MAX).contains(&len) {
            let handle = body[start..j].to_ascii_lowercase();
            if let Some(name) = names.get(&handle) {
                out.push_str(&body[last..i]);
                out.push('@');
                out.push_str(name);
                last = j;
            }
        }
        i = if j > start { j } else { i + 1 };
    }
    out.push_str(&body[last..]);
    out
}

/// Resolve a project's members into `handle → user_id` and `handle → display
/// name` maps for mention fan-out + preview. Members without a handle simply
/// can't be mentioned (until they pick one).
async fn member_handle_maps(
    state: &AppState,
    project_id: &str,
) -> Result<(HashMap<String, String>, HashMap<String, String>), AppError> {
    let members = membership::list(state, project_id).await?;
    let ids: Vec<String> = members.iter().map(|m| m.user_id.clone()).collect();
    let display_by_uid: HashMap<String, String> = members
        .into_iter()
        .map(|m| (m.user_id, m.display_name))
        .collect();
    let refs = user::profile_refs(state, &ids).await?;
    let mut handle_to_uid = HashMap::new();
    let mut handle_to_display = HashMap::new();
    for (uid, r) in &refs {
        if let Some(h) = &r.handle {
            handle_to_uid.insert(h.clone(), uid.clone());
            if let Some(dn) = display_by_uid.get(uid) {
                handle_to_display.insert(h.clone(), dn.clone());
            }
        }
    }
    Ok((handle_to_uid, handle_to_display))
}

/// Build a base item with the common project/actor fields set and all refs None.
#[allow(clippy::too_many_arguments)]
fn base(
    recipient_id: String,
    kind: InboxKind,
    project: &Project,
    actor_id: &str,
    actor_display_name: Option<String>,
    preview: String,
    created_at: &str,
) -> NewInboxItem {
    NewInboxItem {
        recipient_id,
        kind,
        project_id: project.id.clone(),
        project_slug: project.slug.clone(),
        project_name: project.name.clone(),
        actor_id: actor_id.to_string(),
        actor_display_name,
        proposal_id: None,
        comment_id: None,
        conversation_id: None,
        message_id: None,
        document_name: None,
        preview,
        created_at: created_at.to_string(),
    }
}

/// Fan out for a posted chat message: `@mentions` (+ `reply` to prior thread
/// participants when it's a thread reply). DMs are not project-scoped, so they
/// produce no notifications in v1.
pub async fn message_posted(
    state: &AppState,
    meta: &ConversationMeta,
    msg: &Message,
    now: &str,
) -> Result<(), AppError> {
    let ConversationMeta::Channel(c) = meta else {
        return Ok(());
    };
    let project = project::get_by_slug_from_id(state, &c.project_id).await?;
    let (handle_to_uid, handle_to_display) = member_handle_maps(state, &c.project_id).await?;
    let body_preview = preview(&resolve_mention_names(&msg.body, &handle_to_display));

    let mut items: Vec<NewInboxItem> = Vec::new();
    let mut notified: HashSet<String> = HashSet::new();

    // Mentions — resolve each @handle to a member (who can see the message),
    // never the author. Unknown / handle-less users drop out.
    for handle in extract_mentions(&msg.body) {
        let Some(uid) = handle_to_uid.get(&handle) else {
            continue;
        };
        if uid == &msg.author_id || notified.contains(uid) {
            continue;
        }
        let mut it = base(
            uid.clone(),
            InboxKind::Mention,
            &project,
            &msg.author_id,
            Some(msg.author_display_name.clone()),
            body_preview.clone(),
            now,
        );
        it.conversation_id = Some(msg.conversation_id.clone());
        it.message_id = Some(msg.id.clone());
        items.push(it);
        notified.insert(uid.clone());
    }

    // Quote-reply — notify the author of the quoted message that someone replied
    // to them (decision 0031), unless that's the replier themselves or they were
    // already @mentioned in this message. Uses the denormalised snapshot, so no
    // extra read. (Replies are inline messages; we notify the direct target, not
    // a whole thread chain.)
    if let Some(rt) = &msg.reply_to {
        if rt.author_id != msg.author_id && !notified.contains(&rt.author_id) {
            notified.insert(rt.author_id.clone());
            let mut it = base(
                rt.author_id.clone(),
                InboxKind::Reply,
                &project,
                &msg.author_id,
                Some(msg.author_display_name.clone()),
                body_preview.clone(),
                now,
            );
            it.conversation_id = Some(msg.conversation_id.clone());
            it.message_id = Some(msg.id.clone());
            items.push(it);
        }
    }

    fanout(state, items, "message").await
}

/// Fan out for a proposal comment: `comment-on-yours` for the proposal author
/// (unless they wrote it) + `@mentions` for project members.
pub async fn proposal_comment(
    state: &AppState,
    proposal: &Proposal,
    comment: &Comment,
    now: &str,
) -> Result<(), AppError> {
    let body = comment.body.as_deref().unwrap_or("");
    if body.is_empty() {
        return Ok(());
    }
    let project = project::get_by_slug_from_id(state, &proposal.project_id).await?;
    let (handle_to_uid, handle_to_display) =
        member_handle_maps(state, &proposal.project_id).await?;
    let body_preview = preview(&resolve_mention_names(body, &handle_to_display));
    let mut items: Vec<NewInboxItem> = Vec::new();

    if proposal.author_id != comment.author_id {
        let mut it = base(
            proposal.author_id.clone(),
            InboxKind::CommentOnYours,
            &project,
            &comment.author_id,
            Some(comment.author_display_name.clone()),
            body_preview.clone(),
            now,
        );
        it.proposal_id = Some(proposal.id.clone());
        it.comment_id = Some(comment.id.clone());
        items.push(it);
    }

    for handle in extract_mentions(body) {
        let Some(uid) = handle_to_uid.get(&handle) else {
            continue;
        };
        // The proposal author already got `comment-on-yours`; don't double-notify.
        if uid == &comment.author_id || uid == &proposal.author_id {
            continue;
        }
        let mut it = base(
            uid.clone(),
            InboxKind::Mention,
            &project,
            &comment.author_id,
            Some(comment.author_display_name.clone()),
            body_preview.clone(),
            now,
        );
        it.proposal_id = Some(proposal.id.clone());
        it.comment_id = Some(comment.id.clone());
        items.push(it);
    }

    fanout(state, items, "comment").await
}

/// Fan out for a closed deliberation: `proposal-closed` for each decisive
/// (non-abstaining) voter, plus `document-amended` when the winner is a Document.
pub async fn deliberation_closed(
    state: &AppState,
    root: &Proposal,
    winner: Option<&Proposal>,
    now: &str,
) -> Result<(), AppError> {
    let recipients: Vec<String> = {
        let mut seen = HashSet::new();
        vote::voters(state, &root.root_id)
            .await?
            .into_iter()
            .filter(|v| !matches!(v.choice, Choice::Abstain))
            .map(|v| v.user_id)
            .filter(|uid| seen.insert(uid.clone()))
            .collect()
    };
    if recipients.is_empty() {
        return Ok(());
    }
    let project = project::get_by_slug_from_id(state, &root.project_id).await?;
    let closed_preview = match winner {
        Some(w) => preview(&format!("{} → {}", root.title, w.title)),
        None => preview(&format!("{} — no winner", root.title)),
    };
    let proposal_ref = winner.map(|w| w.id.clone()).unwrap_or_else(|| root.id.clone());
    let is_document = root.proposal_kind == ProposalKind::Document
        && winner.is_some()
        && root.document_name.is_some();

    let mut items: Vec<NewInboxItem> = Vec::new();
    for uid in &recipients {
        let mut it = base(
            uid.clone(),
            InboxKind::ProposalClosed,
            &project,
            "system",
            None,
            closed_preview.clone(),
            now,
        );
        it.proposal_id = Some(proposal_ref.clone());
        items.push(it);

        if is_document {
            let doc = root.document_name.clone().unwrap();
            let mut di = base(
                uid.clone(),
                InboxKind::DocumentAmended,
                &project,
                "system",
                None,
                preview(&format!("{doc} — new version")),
                now,
            );
            di.document_name = Some(doc);
            di.proposal_id = winner.map(|w| w.id.clone());
            items.push(di);
        }
    }

    fanout(state, items, "close").await
}

async fn fanout(state: &AppState, items: Vec<NewInboxItem>, trigger: &str) -> Result<(), AppError> {
    if items.is_empty() {
        return Ok(());
    }
    let count = items.len();
    inbox::add_items(state, items).await?;
    // Counts only — previews contain message/comment content (PII), never logged.
    tracing::info!(event = "inbox_fanout", trigger = trigger, recipient_count = count);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_handle_mentions_not_emails() {
        // @marina + @tomas are mentions; the email local part and a too-short
        // @ab are not. Order preserved.
        let body = "hey @marina and @tomas, not @ab, email someone@example.com";
        assert_eq!(
            extract_mentions(body),
            vec!["marina".to_string(), "tomas".to_string()]
        );
    }

    #[test]
    fn mentions_are_lowercased_and_deduped() {
        let body = "@Marina @marina @MARINA";
        assert_eq!(extract_mentions(body), vec!["marina".to_string()]);
    }

    #[test]
    fn over_long_runs_are_not_handles() {
        // 21 chars after @ — longer than a valid handle, so not a mention.
        let body = "@aaaaaaaaaaaaaaaaaaaaa hi";
        assert!(extract_mentions(body).is_empty());
    }

    #[test]
    fn resolves_mention_names_keeping_unicode() {
        let mut names = HashMap::new();
        names.insert("marina".to_string(), "Marina Alves".to_string());
        let body = "@marina pode revisar? 🙏";
        assert_eq!(
            resolve_mention_names(body, &names),
            "@Marina Alves pode revisar? 🙏"
        );
        // Unknown / non-member handle is left as-is.
        assert_eq!(
            resolve_mention_names("hi @rafael", &names),
            "hi @rafael".to_string()
        );
        // Case-insensitive lookup.
        assert_eq!(
            resolve_mention_names("@Marina here", &names),
            "@Marina Alves here".to_string()
        );
    }

    #[test]
    fn preview_truncates_and_collapses() {
        assert_eq!(preview("  a\n\n b  "), "a b");
        let long = "x".repeat(200);
        let p = preview(&long);
        assert!(p.ends_with('…'));
        assert_eq!(p.chars().count(), PREVIEW_LEN);
    }
}
