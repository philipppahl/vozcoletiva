//! Inbox fan-out on write. Called from the trigger handlers (message + comment
//! create, in the API Lambda) and the close job (in the worker Lambda). Each
//! function computes the entitled recipient set and writes one inbox item each.
//!
//! Callers treat these as **best-effort**: a fan-out failure is logged but must
//! never fail the user's underlying action. See decision 0021.

use std::collections::HashSet;

use crate::domain::proposal::ProposalKind;
use crate::domain::vote::Choice;
use crate::repo::comment::Comment;
use crate::repo::conversation::ConversationMeta;
use crate::repo::inbox::{self, InboxKind, NewInboxItem};
use crate::repo::message::Message;
use crate::repo::project::Project;
use crate::repo::proposal::Proposal;
use crate::repo::{membership, message, project, vote};
use crate::error::AppError;
use crate::state::AppState;

const PREVIEW_LEN: usize = 120;
const THREAD_CAP: usize = 12;

fn preview(text: &str) -> String {
    let cleaned = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if cleaned.chars().count() <= PREVIEW_LEN {
        return cleaned;
    }
    let truncated: String = cleaned.chars().take(PREVIEW_LEN - 1).collect();
    format!("{}…", truncated.trim_end())
}

/// Extract `@<sub>` mentions, where `<sub>` is a Cognito sub (a lowercase UUID).
/// Restricting to the UUID shape avoids false positives on ordinary `@word`.
fn extract_mentions(body: &str) -> Vec<String> {
    let bytes = body.as_bytes();
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] != b'@' {
            i += 1;
            continue;
        }
        let start = i + 1;
        let mut j = start;
        while j < bytes.len() && matches!(bytes[j], b'0'..=b'9' | b'a'..=b'f' | b'-') {
            j += 1;
        }
        let token = &body[start..j];
        if is_uuid(token) && seen.insert(token.to_string()) {
            out.push(token.to_string());
        }
        i = if j > start { j } else { i + 1 };
    }
    out
}

fn is_uuid(s: &str) -> bool {
    s.len() == 36
        && s.as_bytes().iter().enumerate().all(|(k, &b)| match k {
            8 | 13 | 18 | 23 => b == b'-',
            _ => matches!(b, b'0'..=b'9' | b'a'..=b'f'),
        })
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
    let members: HashSet<String> = membership::list(state, &c.project_id)
        .await?
        .into_iter()
        .map(|m| m.user_id)
        .collect();

    let mut items: Vec<NewInboxItem> = Vec::new();
    let mut notified: HashSet<String> = HashSet::new();

    // Mentions — only members (who can see the message), never the author.
    for uid in extract_mentions(&msg.body) {
        if uid == msg.author_id || !members.contains(&uid) {
            continue;
        }
        let mut it = base(
            uid.clone(),
            InboxKind::Mention,
            &project,
            &msg.author_id,
            Some(msg.author_display_name.clone()),
            preview(&msg.body),
            now,
        );
        it.conversation_id = Some(msg.conversation_id.clone());
        it.message_id = Some(msg.id.clone());
        items.push(it);
        notified.insert(uid);
    }

    // Thread reply — notify prior participants (parent author + earlier
    // repliers), most-recent 12, unique, excluding the replier and anyone
    // already mentioned in this message.
    if let Some(parent_id) = &msg.parent_message_id {
        let parent = message::top_level_by_id(state, parent_id).await?;
        let replies = message::thread_replies(state, parent_id).await?;
        let mut chain: Vec<String> = vec![parent.author_id.clone()];
        for r in &replies {
            if r.id != msg.id {
                chain.push(r.author_id.clone());
            }
        }
        let recent = &chain[chain.len().saturating_sub(THREAD_CAP)..];
        for author in recent {
            if author == &msg.author_id || notified.contains(author) {
                continue;
            }
            notified.insert(author.clone());
            let mut it = base(
                author.clone(),
                InboxKind::Reply,
                &project,
                &msg.author_id,
                Some(msg.author_display_name.clone()),
                preview(&msg.body),
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
    let mut items: Vec<NewInboxItem> = Vec::new();

    if proposal.author_id != comment.author_id {
        let mut it = base(
            proposal.author_id.clone(),
            InboxKind::CommentOnYours,
            &project,
            &comment.author_id,
            Some(comment.author_display_name.clone()),
            preview(body),
            now,
        );
        it.proposal_id = Some(proposal.id.clone());
        it.comment_id = Some(comment.id.clone());
        items.push(it);
    }

    let members: HashSet<String> = membership::list(state, &proposal.project_id)
        .await?
        .into_iter()
        .map(|m| m.user_id)
        .collect();
    for uid in extract_mentions(body) {
        // The proposal author already got `comment-on-yours`; don't double-notify.
        if uid == comment.author_id || uid == proposal.author_id || !members.contains(&uid) {
            continue;
        }
        let mut it = base(
            uid,
            InboxKind::Mention,
            &project,
            &comment.author_id,
            Some(comment.author_display_name.clone()),
            preview(body),
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
    fn extracts_uuid_mentions_only() {
        let sub = "32b514e4-60c1-70cc-d616-77326d610b5b";
        let body = format!("hey @{sub} and @nobody and email a@b.com");
        assert_eq!(extract_mentions(&body), vec![sub.to_string()]);
    }

    #[test]
    fn dedups_repeated_mentions() {
        let sub = "c2b554e4-a091-7013-dffd-0ccc4a5b82fc";
        let body = format!("@{sub} @{sub}");
        assert_eq!(extract_mentions(&body).len(), 1);
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
