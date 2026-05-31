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
    const body = (await request.json()) as { body: string };
    const id = ulid();
    const comment = {
      id,
      proposalId: String(params.id),
      authorId: me.userId,
      body: body.body,
      createdAt: mockNowIso(),
      editedAt: null,
      deletedAt: null,
      deletedBy: null,
    };
    getDb().comments.set(id, comment);
    return HttpResponse.json(toCommentDto(comment), { status: 201 });
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
