import { HttpResponse, http } from 'msw';

import { mockNowIso } from '../clock';
import {
  channelsForProject,
  dmPair,
  dmsForUser,
  findDmBetween,
  getDb,
  type MockAttachment,
  type MockMessage,
  projectBySlug,
  repliesTo,
  setConversationRead,
  setThreadRead,
  topLevelMessages,
} from '../db';
import { emitMessageMentions, emitThreadReply } from '../inboxEmit';
import { emit } from '../messageBus';
import {
  canAccessConversation,
  requireCurrentUser,
  requireMember,
  toConversationDto,
  toMessageDto,
  ulid,
} from './_helpers';

export const conversationsHandlers = [
  // List channels for a project
  http.get('*/v1/projects/:slug/channels', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!requireMember(slug, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const channels = channelsForProject(project.id).map((c) => toConversationDto(c, me.userId));
    return HttpResponse.json({ channels });
  }),

  // List my DMs across all projects
  http.get('*/v1/dms', () => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const dms = dmsForUser(me.userId).map((c) => toConversationDto(c, me.userId));
    return HttpResponse.json({ dms });
  }),

  // Get one conversation
  http.get('*/v1/conversations/:id', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const conv = getDb().conversations.get(String(params.id));
    if (!conv) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!canAccessConversation(conv, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return HttpResponse.json(toConversationDto(conv, me.userId));
  }),

  // Paginated top-level messages
  http.get('*/v1/conversations/:id/messages', ({ params, request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const conv = getDb().conversations.get(String(params.id));
    if (!conv) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!canAccessConversation(conv, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const url = new URL(request.url);
    const before = url.searchParams.get('before') ?? undefined;
    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw ? Math.min(Number(limitRaw) || 50, 200) : 50;
    const { messages, hasMore } = topLevelMessages(conv.id, { before, limit });
    return HttpResponse.json({
      messages: messages.map(toMessageDto),
      has_more: hasMore,
    });
  }),

  // Thread: parent + all replies
  http.get('*/v1/messages/:id/thread', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const parent = getDb().messages.get(String(params.id));
    if (!parent) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const conv = getDb().conversations.get(parent.conversationId);
    if (!conv || !canAccessConversation(conv, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return HttpResponse.json({
      parent: toMessageDto(parent),
      replies: repliesTo(parent.id).map(toMessageDto),
    });
  }),

  // Post a message (top-level or thread reply)
  http.post('*/v1/conversations/:id/messages', async ({ params, request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const conv = getDb().conversations.get(String(params.id));
    if (!conv) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!canAccessConversation(conv, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const body = (await request.json()) as {
      body: string;
      attachments?: MockAttachment[];
      parent_message_id?: string | null;
    };
    if (body.parent_message_id) {
      const parent = getDb().messages.get(body.parent_message_id);
      if (!parent || parent.conversationId !== conv.id) {
        return HttpResponse.json(
          { error: 'not_found', message: 'Parent message not in this conversation' },
          { status: 404 },
        );
      }
      if (parent.parentMessageId) {
        // We don't allow nested threads — replies can only hang off a top-level message.
        return HttpResponse.json(
          { error: 'conflict', message: 'Cannot reply to a thread reply' },
          { status: 409 },
        );
      }
    }
    const id = `m-${ulid()}`;
    const message: MockMessage = {
      id,
      conversationId: conv.id,
      parentMessageId: body.parent_message_id ?? null,
      authorId: me.userId,
      body: (body.body ?? '').trim(),
      attachments: body.attachments ?? [],
      createdAt: mockNowIso(),
      editedAt: null,
    };
    if (!message.body && message.attachments.length === 0) {
      return HttpResponse.json(
        { error: 'bad_request', message: 'Message must have body or an attachment' },
        { status: 400 },
      );
    }
    getDb().messages.set(id, message);
    emit({ type: 'conversation.message-created', message });
    const inboxCtx = { nowIso: mockNowIso(), idFor: () => `ix-${ulid()}` };
    emitMessageMentions(message, inboxCtx);
    if (message.parentMessageId) emitThreadReply(message, inboxCtx);
    return HttpResponse.json(toMessageDto(message), { status: 201 });
  }),

  // Mark a conversation as read up to a message id
  http.post('*/v1/conversations/:id/read', async ({ params, request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const conv = getDb().conversations.get(String(params.id));
    if (!conv) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!canAccessConversation(conv, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const body = (await request.json()) as { message_id: string };
    const msg = getDb().messages.get(body.message_id);
    if (!msg || msg.conversationId !== conv.id) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    setConversationRead(conv.id, me.userId, msg.id, mockNowIso());
    emit({
      type: 'conversation.read',
      conversationId: conv.id,
      userId: me.userId,
      lastReadMessageId: msg.id,
    });
    return HttpResponse.json({ ok: true });
  }),

  // Mark a thread as read up to a reply id
  http.post('*/v1/messages/:parentId/thread/read', async ({ params, request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const parent = getDb().messages.get(String(params.parentId));
    if (!parent) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const conv = getDb().conversations.get(parent.conversationId);
    if (!conv || !canAccessConversation(conv, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const body = (await request.json()) as { message_id: string };
    setThreadRead(parent.id, me.userId, body.message_id, mockNowIso());
    return HttpResponse.json({ ok: true });
  }),

  // Idempotent DM create — same caller+peer pair always resolves to the same id
  http.post('*/v1/dms', async ({ request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = (await request.json()) as { user_id: string };
    if (!body.user_id) {
      return HttpResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    if (body.user_id === me.userId) {
      return HttpResponse.json(
        { error: 'bad_request', message: 'Cannot DM yourself' },
        { status: 400 },
      );
    }
    const existing = findDmBetween(me.userId, body.user_id);
    if (existing) {
      return HttpResponse.json(toConversationDto(existing, me.userId));
    }
    const [lo, hi] = dmPair(me.userId, body.user_id);
    const id = `dm-${ulid()}`;
    const conv = {
      id,
      kind: 'dm' as const,
      participantIds: [lo, hi] as [string, string],
      createdAt: mockNowIso(),
    };
    getDb().conversations.set(id, conv);
    return HttpResponse.json(toConversationDto(conv, me.userId), { status: 201 });
  }),
];
