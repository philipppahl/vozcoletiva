import { HttpResponse, http } from 'msw';

import { mockNowIso } from '../clock';
import {
  getDb,
  inboxForUser,
  type MockInboxItem,
  markAllInboxRead,
  markInboxItemRead,
  unreadInboxCount,
} from '../db';
import { requireCurrentUser } from './_helpers';

interface InboxItemDto {
  id: string;
  kind: MockInboxItem['kind'];
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

function toItemDto(item: MockInboxItem): InboxItemDto {
  const db = getDb();
  const project = db.projects.get(item.projectId);
  const actor = item.actorId === 'system' ? null : db.users.get(item.actorId);
  return {
    id: item.id,
    kind: item.kind,
    project_id: item.projectId,
    project_slug: project?.slug ?? '',
    project_name: project?.name ?? '',
    actor_id: item.actorId,
    actor_display_name: actor?.displayName ?? null,
    proposal_id: item.proposalId ?? null,
    comment_id: item.commentId ?? null,
    conversation_id: item.conversationId ?? null,
    message_id: item.messageId ?? null,
    document_name: item.documentName ?? null,
    preview: item.preview,
    created_at: item.createdAt,
    read_at: item.readAt ?? null,
  };
}

export const inboxHandlers = [
  http.get('*/v1/me/inbox', ({ request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const url = new URL(request.url);
    const before = url.searchParams.get('before');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);
    let items = inboxForUser(me.userId);
    if (before) items = items.filter((i) => i.createdAt < before);
    items = items.slice(0, limit);
    return HttpResponse.json({
      items: items.map(toItemDto),
      unread_count: unreadInboxCount(me.userId),
    });
  }),

  http.post('*/v1/me/inbox/:id/read', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const ok = markInboxItemRead(String(params.id), me.userId, mockNowIso());
    if (!ok) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/v1/me/inbox/read-all', () => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    markAllInboxRead(me.userId, mockNowIso());
    return new HttpResponse(null, { status: 204 });
  }),
];
