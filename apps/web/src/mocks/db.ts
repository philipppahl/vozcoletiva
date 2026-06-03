/**
 * Mock in-memory store. Entities mirror the OpenAPI schemas so handlers can
 * round-trip them without translation.
 */

import type { components } from '@vozcoletiva/api-client';

export type Role = components['schemas']['Role'];
export type Choice = components['schemas']['Choice'];
export type ProposalStatus = components['schemas']['ProposalStatus'];

export interface MockUser {
  userId: string;
  email: string;
  displayName: string;
}

export interface MockProject {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  template: string;
  visibility: 'private' | 'public';
  createdAt: string;
}

export interface MockMembership {
  projectId: string;
  userId: string;
  role: Role;
  joinedAt: string;
}

export interface MockInvite {
  id: string;
  projectId: string;
  code: string;
  token: string;
  role: Role;
  issuedBy: string;
  issuedAt: string;
  expiresAt?: string | null;
  maxUses?: number | null;
  useCount: number;
  revokedAt?: string | null;
  note?: string | null;
}

export type VotingRule = 'plurality' | 'simple_majority' | 'two_thirds' | 'consensus';

export type ProposalKind = 'decision' | 'document';

export interface MockCategory {
  id: string;
  projectId: string;
  name: string;
  position: number;
  createdAt: string;
}

/** Special vote tokens. Any other value is the picked alternative's proposal id. */
export const VOTE_NONE = '__none__';
export const VOTE_ABSTAIN = '__abstain__';

export interface MockProposal {
  id: string;
  projectId: string;
  authorId: string;
  title: string;
  body: string;
  /** Set on the root only. Forks inherit the root's rule at vote time. */
  votingRule: VotingRule;
  /** Set on the root only. */
  quorum?: number | null;
  status: ProposalStatus;
  createdAt: string;
  /** Set on the root only. Forks inherit. */
  endsAt: string;
  closedAt?: string | null;
  /** Null for root proposals; set to the parent's id when this is a fork. */
  parentId?: string | null;
  /** Always set: equals `id` for roots, otherwise the root's id. */
  rootId: string;
  /** Decision (default) or Document. Set on the root and inherited by forks. */
  proposalKind: ProposalKind;
  /** Only set when proposalKind === 'document'. Stable identifier + display
   *  name for the document this deliberation produces a version of. */
  documentName?: string | null;
  /** Project-scoped category. Required. Forks inherit from the root.
   *  Document amendments inherit from the previous version. */
  categoryId: string;
  /** True on the ROOT of a multi-option decision — it frames the question but
   *  is not itself a votable choice; its children are the options. */
  isQuestion?: boolean;
}

/** A vote is per-deliberation (per root), not per-proposal/alternative.
 *  `choice` is the picked alternative's proposal id, or VOTE_NONE/VOTE_ABSTAIN. */
export interface MockVote {
  rootId: string;
  userId: string;
  choice: string;
  at: string;
}

export interface MockComment {
  id: string;
  proposalId: string;
  authorId: string;
  body: string | null; // null when soft-deleted
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  // chat-style replies + reactions (decision 0033)
  replyTo?: { id: string; authorDisplayName: string; preview: string } | null;
  reactions?: Record<string, string[]>; // emoji → userIds who reacted
}

// ── conversations + messages (M2 — chat) ───────────────────────────────────

export type AttachmentKind = 'image' | 'voice';

export interface MockAttachment {
  kind: AttachmentKind;
  /** Mock URL or inline data URI. */
  url: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export type MockConversation =
  | {
      id: string;
      kind: 'channel';
      projectId: string;
      name: string;
      description?: string | null;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'dm';
      /** Sorted ascending so the pair is a stable lookup key. */
      participantIds: [string, string];
      createdAt: string;
    };

export interface MockMessage {
  id: string;
  conversationId: string;
  /** Set when this is a reply in a thread. Top-level messages have null. */
  parentMessageId?: string | null;
  authorId: string;
  body: string;
  attachments: MockAttachment[];
  createdAt: string;
  editedAt?: string | null;
}

export interface MockConversationRead {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
  at: string;
}

export interface MockThreadRead {
  parentMessageId: string;
  userId: string;
  lastReadMessageId: string;
  at: string;
}

// ── inbox (M5) ─────────────────────────────────────────────────────────────

export type InboxKind =
  | 'mention'
  | 'reply'
  | 'comment-on-yours'
  | 'proposal-closed'
  | 'document-amended';

export interface MockInboxItem {
  id: string;
  /** Recipient. */
  userId: string;
  kind: InboxKind;
  projectId: string;
  /** Who triggered the event. 'system' for proposal-closed. */
  actorId: string;
  // Each kind sets one or two of these. Others stay null.
  proposalId?: string | null;
  commentId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  documentName?: string | null;
  /** Short body preview (≤120 chars) computed at emit time. */
  preview: string;
  createdAt: string;
  readAt?: string | null;
}

export interface Db {
  users: Map<string, MockUser>;
  projects: Map<string, MockProject>;
  memberships: MockMembership[];
  invites: Map<string, MockInvite>;
  proposals: Map<string, MockProposal>;
  comments: Map<string, MockComment>;
  votes: MockVote[];
  conversations: Map<string, MockConversation>;
  messages: Map<string, MockMessage>;
  conversationReads: MockConversationRead[];
  threadReads: MockThreadRead[];
  inboxItems: MockInboxItem[];
  categories: Map<string, MockCategory>;
  /** The signed-in user (set by the auth shim). */
  currentUserId: string | null;
}

function emptyDb(): Db {
  return {
    users: new Map(),
    projects: new Map(),
    memberships: [],
    invites: new Map(),
    proposals: new Map(),
    comments: new Map(),
    votes: [],
    conversations: new Map(),
    messages: new Map(),
    conversationReads: [],
    threadReads: [],
    inboxItems: [],
    categories: new Map(),
    currentUserId: null,
  };
}

let db: Db = emptyDb();

export function getDb(): Db {
  return db;
}

export function resetDb() {
  db = emptyDb();
}

// ── helpers ────────────────────────────────────────────────────────────────

export function membershipOf(projectId: string, userId: string): MockMembership | undefined {
  return db.memberships.find((m) => m.projectId === projectId && m.userId === userId);
}

export function projectsForUser(userId: string): MockProject[] {
  const ids = new Set(db.memberships.filter((m) => m.userId === userId).map((m) => m.projectId));
  return Array.from(db.projects.values()).filter((p) => ids.has(p.id));
}

export function projectBySlug(slug: string): MockProject | undefined {
  return Array.from(db.projects.values()).find((p) => p.slug === slug);
}

export function proposalsForProject(projectId: string): MockProposal[] {
  return Array.from(db.proposals.values()).filter((p) => p.projectId === projectId);
}

export function childrenOf(proposalId: string): MockProposal[] {
  return Array.from(db.proposals.values()).filter((p) => p.parentId === proposalId);
}

export function rootOf(proposal: MockProposal): MockProposal {
  let cursor: MockProposal | undefined = proposal;
  for (let i = 0; i < 32 && cursor?.parentId; i += 1) {
    const next = db.proposals.get(cursor.parentId);
    if (!next) break;
    cursor = next;
  }
  return cursor ?? proposal;
}

/**
 * Depth-first flat tree from `rootId`. Within each depth, siblings are
 * ordered by `createdAt` (stable).
 */
export function treeFlat(rootId: string): MockProposal[] {
  const out: MockProposal[] = [];
  const visit = (id: string) => {
    const node = db.proposals.get(id);
    if (!node) return;
    out.push(node);
    childrenOf(id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((c) => {
        visit(c.id);
      });
  };
  visit(rootId);
  return out;
}

export function commentsForProposal(proposalId: string): MockComment[] {
  return Array.from(db.comments.values())
    .filter((c) => c.proposalId === proposalId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** All votes cast in a deliberation, identified by its root proposal id. */
export function votesForDeliberation(rootId: string): MockVote[] {
  return db.votes.filter((v) => v.rootId === rootId);
}

export function userVote(rootId: string, userId: string): MockVote | undefined {
  return db.votes.find((v) => v.rootId === rootId && v.userId === userId);
}

/** Per-alternative vote count + abstain + "none of these" for one deliberation.
 *  `byChoice[proposalId]` = number of users who picked that alternative. */
export interface DeliberationTally {
  byChoice: Record<string, number>;
  none: number;
  abstain: number;
  /** Decisive = picked an alternative OR "none of these". Abstain not counted. */
  decisive: number;
  /** Total voters including abstainers. */
  total: number;
}

export function deliberationTally(rootId: string): DeliberationTally {
  const byChoice: Record<string, number> = {};
  let none = 0;
  let abstain = 0;
  for (const v of db.votes) {
    if (v.rootId !== rootId) continue;
    if (v.choice === VOTE_ABSTAIN) {
      abstain += 1;
    } else if (v.choice === VOTE_NONE) {
      none += 1;
    } else {
      byChoice[v.choice] = (byChoice[v.choice] ?? 0) + 1;
    }
  }
  const decisive = Object.values(byChoice).reduce((s, n) => s + n, 0) + none;
  return { byChoice, none, abstain, decisive, total: decisive + abstain };
}

// ── conversation + message helpers ─────────────────────────────────────────

/** Canonicalise a DM participant pair so lookups are direction-independent. */
export function dmPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function channelsForProject(projectId: string): MockConversation[] {
  return Array.from(db.conversations.values()).filter(
    (c) => c.kind === 'channel' && c.projectId === projectId,
  );
}

export function dmsForUser(userId: string): MockConversation[] {
  return Array.from(db.conversations.values()).filter(
    (c) => c.kind === 'dm' && c.participantIds.includes(userId),
  );
}

export function findDmBetween(a: string, b: string): MockConversation | undefined {
  const [lo, hi] = dmPair(a, b);
  return Array.from(db.conversations.values()).find(
    (c) => c.kind === 'dm' && c.participantIds[0] === lo && c.participantIds[1] === hi,
  );
}

/**
 * Top-level messages in a conversation (excludes thread replies), sorted by
 * createdAt ascending. `before` paginates backward: returns messages whose
 * createdAt < the `before` message's createdAt.
 */
export function topLevelMessages(
  conversationId: string,
  opts: { before?: string; limit?: number } = {},
): { messages: MockMessage[]; hasMore: boolean } {
  const all = Array.from(db.messages.values())
    .filter((m) => m.conversationId === conversationId && !m.parentMessageId)
    .sort((a, b) =>
      a.createdAt === b.createdAt
        ? a.id.localeCompare(b.id)
        : a.createdAt.localeCompare(b.createdAt),
    );
  let cutoffIdx = all.length;
  if (opts.before) {
    const cursor = db.messages.get(opts.before);
    if (cursor) {
      cutoffIdx = all.findIndex(
        (m) =>
          m.createdAt > cursor.createdAt || (m.createdAt === cursor.createdAt && m.id >= cursor.id),
      );
      if (cutoffIdx < 0) cutoffIdx = all.length;
    }
  }
  const limit = opts.limit ?? 50;
  const start = Math.max(0, cutoffIdx - limit);
  return {
    messages: all.slice(start, cutoffIdx),
    hasMore: start > 0,
  };
}

export function repliesTo(parentMessageId: string): MockMessage[] {
  return Array.from(db.messages.values())
    .filter((m) => m.parentMessageId === parentMessageId)
    .sort((a, b) =>
      a.createdAt === b.createdAt
        ? a.id.localeCompare(b.id)
        : a.createdAt.localeCompare(b.createdAt),
    );
}

export function lastTopLevelMessage(conversationId: string): MockMessage | undefined {
  const { messages } = topLevelMessages(conversationId, { limit: 1 });
  return messages[messages.length - 1];
}

export function conversationReadFor(
  conversationId: string,
  userId: string,
): MockConversationRead | undefined {
  return db.conversationReads.find(
    (r) => r.conversationId === conversationId && r.userId === userId,
  );
}

export function setConversationRead(
  conversationId: string,
  userId: string,
  messageId: string,
  at: string,
) {
  const existing = db.conversationReads.findIndex(
    (r) => r.conversationId === conversationId && r.userId === userId,
  );
  const row: MockConversationRead = {
    conversationId,
    userId,
    lastReadMessageId: messageId,
    at,
  };
  if (existing >= 0) db.conversationReads[existing] = row;
  else db.conversationReads.push(row);
}

export function threadReadFor(parentMessageId: string, userId: string): MockThreadRead | undefined {
  return db.threadReads.find((r) => r.parentMessageId === parentMessageId && r.userId === userId);
}

export function setThreadRead(
  parentMessageId: string,
  userId: string,
  messageId: string,
  at: string,
) {
  const existing = db.threadReads.findIndex(
    (r) => r.parentMessageId === parentMessageId && r.userId === userId,
  );
  const row: MockThreadRead = {
    parentMessageId,
    userId,
    lastReadMessageId: messageId,
    at,
  };
  if (existing >= 0) db.threadReads[existing] = row;
  else db.threadReads.push(row);
}

/** Count of top-level messages in this conversation created after the user's
 *  last-read marker. */
export function conversationUnreadCount(conversationId: string, userId: string): number {
  const marker = conversationReadFor(conversationId, userId);
  const top = Array.from(db.messages.values()).filter(
    (m) => m.conversationId === conversationId && !m.parentMessageId,
  );
  if (!marker) return top.length;
  const markerMsg = db.messages.get(marker.lastReadMessageId);
  if (!markerMsg) return top.length;
  return top.filter(
    (m) =>
      m.createdAt > markerMsg.createdAt ||
      (m.createdAt === markerMsg.createdAt && m.id > markerMsg.id),
  ).length;
}

// ── document derivation helpers ────────────────────────────────────────────
//
// Documents have no entity of their own — they are derived views over
// proposals where `proposalKind === 'document'` and `documentName` is set.
// See docs/decisions/0004-documents-mock-first.md.

/** Distinct document names with at least one passed proposal in this project. */
export function documentsForProject(projectId: string): string[] {
  const names = new Set<string>();
  for (const p of db.proposals.values()) {
    if (p.projectId !== projectId) continue;
    if (p.proposalKind !== 'document') continue;
    if (p.status !== 'passed') continue;
    if (!p.documentName) continue;
    names.add(p.documentName);
  }
  return Array.from(names).sort();
}

/** All proposals (any status) targeting this document name in this project. */
export function proposalsForDocument(projectId: string, documentName: string): MockProposal[] {
  return Array.from(db.proposals.values()).filter(
    (p) =>
      p.projectId === projectId && p.proposalKind === 'document' && p.documentName === documentName,
  );
}

/** Past passed proposals (= versions) for a document, most-recent first. */
export function documentVersions(projectId: string, documentName: string): MockProposal[] {
  return proposalsForDocument(projectId, documentName)
    .filter((p) => p.status === 'passed' && p.closedAt)
    .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
}

/** Current (most-recently-passed) version, or undefined if none yet. */
export function documentCurrentVersion(
  projectId: string,
  documentName: string,
): MockProposal | undefined {
  return documentVersions(projectId, documentName)[0];
}

/** Active (status=voting) Document deliberation for this document, if any.
 *  Used to enforce "at most one active Document proposal per name". */
export function activeDocumentDeliberation(
  projectId: string,
  documentName: string,
): MockProposal | undefined {
  return proposalsForDocument(projectId, documentName).find(
    (p) => p.status === 'voting' && !p.parentId,
  );
}

// ── category helpers ───────────────────────────────────────────────────────

export function categoriesForProject(projectId: string): MockCategory[] {
  return Array.from(db.categories.values())
    .filter((c) => c.projectId === projectId)
    .sort((a, b) => a.position - b.position);
}

export function categoryById(categoryId: string): MockCategory | undefined {
  return db.categories.get(categoryId);
}

export function findCategoryByName(projectId: string, name: string): MockCategory | undefined {
  const target = name.trim().toLowerCase();
  return categoriesForProject(projectId).find((c) => c.name.toLowerCase() === target);
}

/** First category by position. Used as the server-side default when a client
 *  doesn't specify one on POST proposals. */
export function defaultCategoryFor(projectId: string): MockCategory | undefined {
  return categoriesForProject(projectId)[0];
}

export function addCategory(category: MockCategory): void {
  db.categories.set(category.id, category);
}

/** Remove a category. Returns false (no-op) if any proposal still references
 *  it or it would leave the project with zero categories. */
export function removeCategory(categoryId: string): boolean {
  const cat = db.categories.get(categoryId);
  if (!cat) return false;
  const stillReferenced = Array.from(db.proposals.values()).some(
    (p) => p.categoryId === categoryId,
  );
  if (stillReferenced) return false;
  const remaining = categoriesForProject(cat.projectId).filter((c) => c.id !== categoryId);
  if (remaining.length === 0) return false;
  db.categories.delete(categoryId);
  return true;
}

// ── inbox helpers ──────────────────────────────────────────────────────────

/** All inbox items for a user, newest first. */
export function inboxForUser(userId: string): MockInboxItem[] {
  return db.inboxItems
    .filter((i) => i.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Count of unread items for a user. */
export function unreadInboxCount(userId: string): number {
  return db.inboxItems.filter((i) => i.userId === userId && !i.readAt).length;
}

/** Append an inbox item. The id is provided by the caller (typically a ULID
 *  from `ulid()`); we keep db.ts pure of clock dependencies. */
export function addInboxItem(item: MockInboxItem): void {
  db.inboxItems.push(item);
}

/** Mark a single item read. Returns false if no item matches or it isn't
 *  the caller's. */
export function markInboxItemRead(itemId: string, userId: string, atIso: string): boolean {
  const item = db.inboxItems.find((i) => i.id === itemId);
  if (!item || item.userId !== userId) return false;
  if (!item.readAt) item.readAt = atIso;
  return true;
}

/** Mark every item for this user read. */
export function markAllInboxRead(userId: string, atIso: string): void {
  for (const item of db.inboxItems) {
    if (item.userId === userId && !item.readAt) item.readAt = atIso;
  }
}

/** Count of replies in this thread created after the user's per-thread
 *  last-read marker. Returns 0 when the user has never opened the thread. */
export function threadUnreadCount(parentMessageId: string, userId: string): number {
  const marker = threadReadFor(parentMessageId, userId);
  const replies = repliesTo(parentMessageId);
  if (!marker) {
    // Heuristic: if the user hasn't opened the thread, the unread count is the
    // number of replies created after the parent's conversation-level read.
    const parent = db.messages.get(parentMessageId);
    if (!parent) return 0;
    const convMarker = conversationReadFor(parent.conversationId, userId);
    if (!convMarker) return replies.length;
    const convMarkerMsg = db.messages.get(convMarker.lastReadMessageId);
    if (!convMarkerMsg) return replies.length;
    return replies.filter(
      (r) =>
        r.createdAt > convMarkerMsg.createdAt ||
        (r.createdAt === convMarkerMsg.createdAt && r.id > convMarkerMsg.id),
    ).length;
  }
  const markerMsg = db.messages.get(marker.lastReadMessageId);
  if (!markerMsg) return replies.length;
  return replies.filter(
    (r) =>
      r.createdAt > markerMsg.createdAt ||
      (r.createdAt === markerMsg.createdAt && r.id > markerMsg.id),
  ).length;
}
