import { HttpResponse, http } from 'msw';

import { mockNowIso } from '../clock';
import { commentsForProposal, getDb, projectBySlug } from '../db';
import {
  listCommentsDtoForProposal,
  requireCurrentUser,
  requireMember,
  toCommentDto,
  ulid,
} from './_helpers';

const REACTION_RE = /\/v1\/projects\/[^/]+\/proposals\/[^/]+\/comments\/[^/]+\/reactions(?:\?|$)/;

export const commentsHandlers = [
  http.get('*/v1/projects/:slug/proposals/:id/comments', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const project = projectBySlug(String(params.slug));
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!requireMember(String(params.slug), me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return HttpResponse.json({ comments: listCommentsDtoForProposal(String(params.id)) });
  }),

  http.post('*/v1/projects/:slug/proposals/:id/comments', async ({ params, request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const project = projectBySlug(String(params.slug));
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const m = requireMember(String(params.slug), me.userId);
    if (!m || m.role === 'observer') {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const body = (await request.json()) as { body: string; reply_to_id?: string | null };
    const id = ulid();
    let replyTo: { id: string; authorDisplayName: string; preview: string } | null = null;
    if (body.reply_to_id) {
      const parent = getDb().comments.get(body.reply_to_id);
      if (parent) {
        const flat = (parent.body ?? '').split(/\s+/).filter(Boolean).join(' ');
        replyTo = {
          id: parent.id,
          authorDisplayName: getDb().users.get(parent.authorId)?.displayName ?? parent.authorId,
          preview: flat.length > 120 ? `${flat.slice(0, 119)}…` : flat,
        };
      }
    }
    const comment = {
      id,
      proposalId: String(params.id),
      authorId: me.userId,
      body: body.body,
      createdAt: mockNowIso(),
      editedAt: null,
      deletedAt: null,
      deletedBy: null,
      replyTo,
      reactions: {},
    };
    getDb().comments.set(id, comment);
    return HttpResponse.json(toCommentDto(comment), { status: 201 });
  }),

  // Regexp matcher: the string path-pattern form (…/comments/:commentId/…)
  // doesn't match under MSW 2.14 / path-to-regexp v8. Slug + commentId are
  // parsed from the URL instead of the (absent) named params.
  http.put(REACTION_RE, async ({ request }) => {
    const seg = new URL(request.url).pathname.split('/');
    const slug = seg[seg.indexOf('projects') + 1] ?? '';
    const commentId = seg[seg.indexOf('comments') + 1] ?? '';
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (!requireMember(slug, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const comment = getDb().comments.get(commentId);
    if (!comment) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const { emoji, active } = (await request.json()) as { emoji: string; active: boolean };
    comment.reactions ??= {};
    const ids = comment.reactions[emoji] ?? [];
    comment.reactions[emoji] = active
      ? ids.includes(me.userId)
        ? ids
        : [...ids, me.userId]
      : ids.filter((uid) => uid !== me.userId);
    const reactions = Object.entries(comment.reactions)
      .filter(([, a]) => a.length > 0)
      .map(([e, a]) => ({ emoji: e, count: a.length, me: a.includes(me.userId) }));
    return HttpResponse.json({ reactions });
  }),

  http.patch(
    '*/v1/projects/:slug/proposals/:id/comments/:commentId',
    async ({ params, request }) => {
      const me = requireCurrentUser();
      if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
      const comment = getDb().comments.get(String(params.commentId));
      if (!comment) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
      if (comment.authorId !== me.userId) {
        return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      if (comment.deletedAt) {
        return HttpResponse.json({ error: 'conflict' }, { status: 409 });
      }
      const body = (await request.json()) as { body: string };
      comment.body = body.body;
      comment.editedAt = mockNowIso();
      return HttpResponse.json(toCommentDto(comment));
    },
  ),

  http.delete('*/v1/projects/:slug/proposals/:id/comments/:commentId', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const m = requireMember(String(params.slug), me.userId);
    if (!m) return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    const comment = getDb().comments.get(String(params.commentId));
    if (!comment) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const isAuthor = comment.authorId === me.userId;
    const canModerate = m.role === 'owner' || m.role === 'admin' || m.role === 'moderator';
    if (!isAuthor && !canModerate) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    comment.body = null;
    comment.deletedAt = mockNowIso();
    comment.deletedBy = me.userId;
    return HttpResponse.json(toCommentDto(comment));
  }),
];

// Re-export for the test harness.
export { commentsForProposal };
