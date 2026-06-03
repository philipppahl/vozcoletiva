/**
 * Chat types. Mock-first this slice — these mirror what the eventual real
 * OpenAPI spec will declare. See docs/decisions/0003-messages-mock-first.md.
 */

export type AttachmentKind = 'image' | 'doc' | 'voice';

export interface Attachment {
  kind: AttachmentKind;
  /** Public CDN URL — present on received attachments + after upload. */
  url: string;
  /** S3 key — present on outgoing attachments (used to post the message). */
  key?: string;
  mime?: string;
  name?: string;
  size?: number;
  width?: number;
  height?: number;
  duration_ms?: number;
  /** Client-only: the attachment is still uploading (composer state). */
  _uploading?: boolean;
}

export interface MessagePreview {
  author_display_name: string;
  body_preview: string;
  at: string;
}

/** The fixed reaction set (decision 0031) — must match the server's. */
export const REACTIONS = ['👍', '❤️', '😂', '🎉', '🙏', '👀'] as const;

/** A reaction tally on a message: emoji, how many reacted, did the viewer. */
export interface Reaction {
  emoji: string;
  count: number;
  me: boolean;
}

/** Compute the next reaction tallies after the viewer toggles `emoji` to
 *  `active` (decision 0031) — the optimistic update. Pure (no API client). */
export function applyReactionToggle(
  reactions: Reaction[],
  emoji: string,
  active: boolean,
): Reaction[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (active) {
    if (!existing) return [...reactions, { emoji, count: 1, me: true }];
    if (existing.me) return reactions; // already reacted
    return reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, me: true } : r));
  }
  if (!existing || !existing.me) return reactions; // nothing to remove
  const count = existing.count - 1;
  if (count <= 0) return reactions.filter((r) => r.emoji !== emoji);
  return reactions.map((r) => (r.emoji === emoji ? { ...r, count, me: false } : r));
}

/** Immutable snapshot of the message a reply quotes (decision 0031). */
export interface ReplyTo {
  id: string;
  author_display_name: string;
  preview: string;
  kind: 'text' | AttachmentKind;
}

/** Build the quote snapshot an optimistic reply shows before the server echoes
 *  it back. Mirrors the server's `quote_snapshot` (text wins, else media kind).
 *  Pure (no API client) so it's unit-testable without the app's compile-time env. */
export function toReplyTo(m: Message): ReplyTo {
  const hasText = m.body.trim().length > 0;
  return {
    id: m.id,
    author_display_name: m.author_display_name,
    preview: hasText ? m.body.slice(0, 80) : '',
    kind: hasText ? 'text' : (m.attachments[0]?.kind ?? 'text'),
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  /** Set when this message quotes another (decision 0031). Replies live inline. */
  reply_to?: ReplyTo | null;
  author_id: string;
  author_display_name: string;
  body: string;
  attachments: Attachment[];
  created_at: string;
  edited_at?: string | null;
  reply_count: number;
  last_reply_at?: string | null;
  reactions: Reaction[];
  /** Client-only: set on an optimistic message until the server confirms it. */
  _optimistic?: 'pending' | 'failed';
}

export interface ChannelConversation {
  kind: 'channel';
  id: string;
  project_id: string;
  name: string;
  description?: string | null;
  member_count: number;
  last_message: MessagePreview | null;
  unread_count: number;
}

export interface DmParticipant {
  user_id: string;
  display_name: string;
  handle?: string | null;
  avatar_url?: string | null;
}

export interface DmConversation {
  kind: 'dm';
  id: string;
  participants: DmParticipant[];
  last_message: MessagePreview | null;
  unread_count: number;
}

export type Conversation = ChannelConversation | DmConversation;

export interface ChannelListResponse {
  channels: ChannelConversation[];
}

export interface DmListResponse {
  dms: DmConversation[];
}

export interface MessageListResponse {
  messages: Message[];
  has_more: boolean;
}

export interface ThreadResponse {
  parent: Message;
  replies: Message[];
}
