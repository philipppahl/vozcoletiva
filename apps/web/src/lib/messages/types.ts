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

export interface Message {
  id: string;
  conversation_id: string;
  parent_message_id?: string | null;
  author_id: string;
  author_display_name: string;
  body: string;
  attachments: Attachment[];
  created_at: string;
  edited_at?: string | null;
  reply_count: number;
  last_reply_at?: string | null;
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
