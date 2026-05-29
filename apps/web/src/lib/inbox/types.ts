export type InboxKind =
  | 'mention'
  | 'reply'
  | 'comment-on-yours'
  | 'proposal-closed'
  | 'document-amended';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  project_id: string;
  project_slug: string;
  project_name: string;
  actor_id: string;
  actor_display_name: string | null;
  proposal_id?: string | null;
  comment_id?: string | null;
  conversation_id?: string | null;
  message_id?: string | null;
  document_name?: string | null;
  preview: string;
  created_at: string;
  read_at: string | null;
}

export interface InboxListResponse {
  items: InboxItem[];
  unread_count: number;
}
