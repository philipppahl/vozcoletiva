import type { components } from '@vozcoletiva/api-client';

import { mockNow } from '../clock';
import {
  commentsForProposal,
  conversationUnreadCount,
  deliberationTally,
  getDb,
  lastTopLevelMessage,
  type MockComment,
  type MockConversation,
  type MockMessage,
  type MockProject,
  type MockProposal,
  type MockUser,
  membershipOf,
  proposalsForProject,
  repliesTo,
  treeFlat,
  userVote,
} from '../db';
import { decideOutcome } from '../outcome';

type Project = components['schemas']['Project'];
type Member = components['schemas']['Member'];
type Proposal = components['schemas']['Proposal'];
type Comment = components['schemas']['Comment'];

/** Compute the deliberation-level tally + the fork-tree fields the FE expects.
 *  See docs/decisions/0005-voting-model-simplified.md for the vote shape.
 *  Extra fields are silently passed through `openapi-fetch` and consumed by
 *  the FE shim until the real OpenAPI spec catches up. */
export function toProposalDto(p: MockProposal, viewerId: string | null): Proposal {
  const t = deliberationTally(p.rootId);
  const mine = viewerId ? userVote(p.rootId, viewerId) : undefined;
  return {
    id: p.id,
    project_id: p.projectId,
    root_id: p.rootId,
    parent_id: p.parentId ?? null,
    category_id: p.categoryId,
    proposal_kind: p.proposalKind,
    document_name: p.documentName ?? null,
    is_question: p.isQuestion ?? false,
    author_id: p.authorId,
    title: p.title,
    body: p.body,
    voting_rule: p.votingRule,
    quorum: p.quorum ?? null,
    status: p.status,
    created_at: p.createdAt,
    ends_at: p.endsAt,
    closed_at: p.closedAt ?? null,
    // Per-deliberation tally (matches the real API DTO).
    tally_by_choice: t.byChoice,
    tally_none: t.none,
    tally_abstain: t.abstain,
    tally_decisive: t.decisive,
    tally_total: t.total,
    // The caller's raw choice: a proposal id, VOTE_NONE, VOTE_ABSTAIN, or null.
    your_choice: mine?.choice ?? null,
  } as Proposal;
}

export function toProjectDto(p: MockProject): Project {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    owner_id: p.ownerId,
    template: p.template,
    visibility: p.visibility,
    created_at: p.createdAt,
  };
}

export function toMemberDto(userId: string, role: Member['role'], joinedAt: string): Member {
  const u = getDb().users.get(userId);
  return {
    user_id: userId,
    display_name: u?.displayName ?? userId,
    role,
    joined_at: joinedAt,
  };
}

export function toCommentDto(c: MockComment): Comment {
  const db = getDb();
  const author = db.users.get(c.authorId);
  const meId = db.currentUserId;
  const reactions = Object.entries(c.reactions ?? {})
    .filter(([, ids]) => ids.length > 0)
    .map(([emoji, ids]) => ({ emoji, count: ids.length, me: !!meId && ids.includes(meId) }));
  return {
    id: c.id,
    proposal_id: c.proposalId,
    author_id: c.authorId,
    author_display_name: author?.displayName ?? c.authorId,
    body: c.body,
    created_at: c.createdAt,
    edited_at: c.editedAt ?? null,
    deleted_at: c.deletedAt ?? null,
    deleted_by: c.deletedBy ?? null,
    reply_to: c.replyTo
      ? {
          id: c.replyTo.id,
          author_display_name: c.replyTo.authorDisplayName,
          preview: c.replyTo.preview,
        }
      : null,
    reactions,
  };
}

/** Re-runs the close transition for deliberations whose root `ends_at` has
 *  passed but whose proposals are still `voting`. Lets clock-offset scenarios
 *  show closed states.
 *
 *  Operates per-root: when a root's ends_at is in the past, decide the
 *  outcome via `decideOutcome` and apply it to every proposal in the tree
 *  (winner → 'passed', losers → 'rejected', all → 'quorum_failed' if quorum
 *  failed). For solo proposals (no children) the tree is just the proposal
 *  itself. */
export function autoCloseDuePoll(projectId?: string) {
  const db = getDb();
  const now = mockNow();
  const candidates: MockProposal[] = projectId
    ? proposalsForProject(projectId)
    : Array.from(db.proposals.values());
  // Group by root so we close each deliberation once.
  const roots = new Set<string>();
  for (const p of candidates) {
    if (p.status !== 'voting') continue;
    roots.add(p.rootId);
  }
  const closedAt = new Date(now).toISOString();
  for (const rootId of roots) {
    const root = db.proposals.get(rootId);
    if (!root) continue;
    if (Date.parse(root.endsAt) > now) continue;
    const tree = treeFlat(rootId).filter((p) => p.status === 'voting');
    if (tree.length === 0) continue;
    const tally = deliberationTally(rootId);
    const outcome = decideOutcome(tree, tally, root.votingRule, root.quorum);
    for (const p of tree) {
      if (outcome.status === 'quorum_failed') {
        p.status = 'quorum_failed';
      } else if (p.isQuestion) {
        // The question root isn't a votable choice — it "passed" if any option
        // won, otherwise the deliberation produced no winner.
        p.status = outcome.winnerId ? 'passed' : 'rejected';
      } else if (outcome.winnerId === p.id) {
        p.status = 'passed';
      } else {
        p.status = 'rejected';
      }
      p.closedAt = closedAt;
      db.proposals.set(p.id, p);
    }
  }
}

export function requireCurrentUser(): MockUser | null {
  const db = getDb();
  return db.currentUserId ? (db.users.get(db.currentUserId) ?? null) : null;
}

export function requireMember(
  slug: string,
  viewerId: string,
): { project: MockProject; role: Member['role'] } | null {
  const project = Array.from(getDb().projects.values()).find((p) => p.slug === slug);
  if (!project) return null;
  const m = membershipOf(project.id, viewerId);
  if (!m) return null;
  return { project, role: m.role };
}

export function projectListForViewer(viewerId: string) {
  const db = getDb();
  return db.memberships
    .filter((m) => m.userId === viewerId)
    .map((m) => ({
      project: db.projects.get(m.projectId)!,
      role: m.role,
    }))
    .filter((e) => e.project);
}

export function listCommentsDtoForProposal(proposalId: string): Comment[] {
  return commentsForProposal(proposalId).map(toCommentDto);
}

export function ulid(): string {
  // Lightweight time-ordered id; not a real ULID but recognisable shape.
  const t = Date.now().toString(36).toUpperCase().padStart(10, '0');
  const r = Math.random().toString(36).toUpperCase().slice(2, 12);
  return `01M${t}${r}`.padEnd(26, '0').slice(0, 26);
}

// ── conversations + messages (M2 — chat) ───────────────────────────────────
//
// The shape is FE-only this slice — the OpenAPI spec doesn't know about it
// yet. See docs/decisions/0003-messages-mock-first.md. The FE has matching
// types under `lib/messages/types.ts` it casts through.

export function toMessageDto(m: MockMessage) {
  const author = getDb().users.get(m.authorId);
  const replyCount = repliesTo(m.id).length;
  const lastReply = replyCount > 0 ? repliesTo(m.id).slice(-1)[0] : null;
  return {
    id: m.id,
    conversation_id: m.conversationId,
    parent_message_id: m.parentMessageId ?? null,
    author_id: m.authorId,
    author_display_name: author?.displayName ?? m.authorId,
    body: m.body,
    attachments: m.attachments,
    created_at: m.createdAt,
    edited_at: m.editedAt ?? null,
    reply_count: replyCount,
    last_reply_at: lastReply?.createdAt ?? null,
  };
}

export function toConversationDto(c: MockConversation, viewerId: string) {
  const db = getDb();
  const last = lastTopLevelMessage(c.id);
  const lastMessagePreview = last
    ? {
        author_display_name: db.users.get(last.authorId)?.displayName ?? last.authorId,
        body_preview: previewOf(last),
        at: last.createdAt,
      }
    : null;
  const unread = conversationUnreadCount(c.id, viewerId);
  if (c.kind === 'channel') {
    const memberCount = db.memberships.filter((m) => m.projectId === c.projectId).length;
    return {
      kind: 'channel' as const,
      id: c.id,
      project_id: c.projectId,
      name: c.name,
      description: c.description ?? null,
      member_count: memberCount,
      last_message: lastMessagePreview,
      unread_count: unread,
    };
  }
  return {
    kind: 'dm' as const,
    id: c.id,
    participants: c.participantIds.map((id) => ({
      user_id: id,
      display_name: db.users.get(id)?.displayName ?? id,
    })),
    last_message: lastMessagePreview,
    unread_count: unread,
  };
}

function previewOf(m: MockMessage): string {
  if (m.body) return m.body.slice(0, 80);
  const first = m.attachments[0];
  if (!first) return '';
  return first.kind === 'image' ? '📎 image' : '🎙 voice note';
}

/** Membership check, scoped to the conversation. Channel = project member;
 *  DM = participant. */
export function canAccessConversation(c: MockConversation, viewerId: string): boolean {
  if (c.kind === 'channel') {
    return getDb().memberships.some((m) => m.projectId === c.projectId && m.userId === viewerId);
  }
  return c.participantIds.includes(viewerId);
}
