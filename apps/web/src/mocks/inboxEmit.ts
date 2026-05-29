/**
 * Auto-emit helpers for inbox items. Called from the mock handlers that
 * perform the trigger mutations (message create, comment create, deliberation
 * close). Each helper computes the recipient set, builds a preview, and
 * pushes one MockInboxItem per recipient.
 *
 * Kept pure-ish: no clock, no random — callers pass the current ISO time and
 * an `idFor(recipient)` factory (so we can dependency-inject ulid in handlers
 * and a deterministic counter in tests).
 *
 * Self-mentions / self-replies / self-comments are filtered out.
 */

import { parseMentions } from '../components/messages/mentions';
import {
  addInboxItem,
  getDb,
  type InboxKind,
  type MockComment,
  type MockMessage,
  type MockProposal,
  repliesTo,
  VOTE_ABSTAIN,
  VOTE_NONE,
  votesForDeliberation,
} from './db';

interface EmitContext {
  /** ISO timestamp to stamp items with. */
  nowIso: string;
  /** Factory for new item ids. Caller-supplied so we don't bake in ulid here. */
  idFor: () => string;
}

const PREVIEW_LEN = 120;

function preview(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= PREVIEW_LEN) return cleaned;
  return `${cleaned.slice(0, PREVIEW_LEN - 1).trimEnd()}…`;
}

/** Extract distinct mentioned user ids from a body, filtered to actual users. */
function mentionedUserIds(body: string): string[] {
  const db = getDb();
  const seen = new Set<string>();
  for (const seg of parseMentions(body)) {
    if (seg.kind !== 'mention') continue;
    if (db.users.has(seg.userId)) seen.add(seg.userId);
  }
  return Array.from(seen);
}

/** Mentions inside a chat message. */
export function emitMessageMentions(message: MockMessage, ctx: EmitContext): void {
  const db = getDb();
  const conv = db.conversations.get(message.conversationId);
  if (!conv) return;
  const projectId = conv.kind === 'channel' ? conv.projectId : '';
  if (!projectId) return; // DMs aren't project-scoped; skip mentions there for v1.
  for (const userId of mentionedUserIds(message.body)) {
    if (userId === message.authorId) continue;
    addInboxItem({
      id: ctx.idFor(),
      userId,
      kind: 'mention',
      projectId,
      actorId: message.authorId,
      conversationId: message.conversationId,
      messageId: message.id,
      preview: preview(message.body),
      createdAt: ctx.nowIso,
    });
  }
}

/** Replies inside a chat thread. Notify every previous participant in the
 *  thread (capped at 12 most-recent) other than the replier. */
export function emitThreadReply(reply: MockMessage, ctx: EmitContext): void {
  if (!reply.parentMessageId) return;
  const db = getDb();
  const conv = db.conversations.get(reply.conversationId);
  if (!conv) return;
  const projectId = conv.kind === 'channel' ? conv.projectId : '';
  if (!projectId) return; // DMs out of scope for thread replies (no threads in DM).
  const parent = db.messages.get(reply.parentMessageId);
  if (!parent) return;
  const allPrior = [parent, ...repliesTo(reply.parentMessageId)].filter((m) => m.id !== reply.id);
  const recent = allPrior.slice(-12);
  const seen = new Set<string>();
  for (const m of recent) {
    if (m.authorId === reply.authorId) continue;
    if (seen.has(m.authorId)) continue;
    seen.add(m.authorId);
    addInboxItem({
      id: ctx.idFor(),
      userId: m.authorId,
      kind: 'reply',
      projectId,
      actorId: reply.authorId,
      conversationId: reply.conversationId,
      messageId: reply.id,
      preview: preview(reply.body),
      createdAt: ctx.nowIso,
    });
  }
}

/** Comment on a proposal. Issues one `comment-on-yours` for the proposal
 *  author (unless they ARE the commenter) + `mention` items for any
 *  `@u-id` in the comment body. */
export function emitProposalComment(comment: MockComment, ctx: EmitContext): void {
  const db = getDb();
  const proposal = db.proposals.get(comment.proposalId);
  if (!proposal) return;
  if (comment.body && proposal.authorId !== comment.authorId) {
    addInboxItem({
      id: ctx.idFor(),
      userId: proposal.authorId,
      kind: 'comment-on-yours',
      projectId: proposal.projectId,
      actorId: comment.authorId,
      proposalId: proposal.id,
      commentId: comment.id,
      preview: preview(comment.body),
      createdAt: ctx.nowIso,
    });
  }
  if (!comment.body) return;
  for (const userId of mentionedUserIds(comment.body)) {
    if (userId === comment.authorId) continue;
    if (userId === proposal.authorId) continue; // they already got the comment-on-yours
    addInboxItem({
      id: ctx.idFor(),
      userId,
      kind: 'mention',
      projectId: proposal.projectId,
      actorId: comment.authorId,
      proposalId: proposal.id,
      commentId: comment.id,
      preview: preview(comment.body),
      createdAt: ctx.nowIso,
    });
  }
}

/** Deliberation closed. One item per decisive voter (skips abstainers).
 *  If the winning proposal had proposal_kind=document, ALSO emits a
 *  document-amended item for the same recipients. */
export function emitDeliberationClosed(
  root: MockProposal,
  winnerId: string | null,
  ctx: EmitContext,
): void {
  const voters = votesForDeliberation(root.id)
    .filter((v) => v.choice !== VOTE_ABSTAIN)
    .map((v) => v.userId);
  const unique = Array.from(new Set(voters));
  const winner = winnerId ? getDb().proposals.get(winnerId) : null;
  const sourcePreview = preview(
    winner ? `${root.title} → ${winner.title}` : `${root.title} — no winner`,
  );
  for (const userId of unique) {
    addInboxItem({
      id: ctx.idFor(),
      userId,
      kind: 'proposal-closed',
      projectId: root.projectId,
      actorId: 'system',
      proposalId: winner?.id ?? root.id,
      preview: sourcePreview,
      createdAt: ctx.nowIso,
    });
    if (root.proposalKind === 'document' && winner && root.documentName) {
      addInboxItem({
        id: ctx.idFor(),
        userId,
        kind: 'document-amended',
        projectId: root.projectId,
        actorId: 'system',
        documentName: root.documentName,
        proposalId: winner.id,
        preview: preview(`${root.documentName} — new version`),
        createdAt: ctx.nowIso,
      });
    }
  }
}

/** Re-exports for callers that want to introspect kinds. */
export type { InboxKind };
export { VOTE_NONE };
