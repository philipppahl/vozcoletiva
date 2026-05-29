import { HttpResponse, http } from 'msw';

import { getDb, projectBySlug } from '../db';
import { requireCurrentUser, requireMember, toMemberDto } from './_helpers';

export const membersHandlers = [
  http.get('*/v1/projects/:slug/members', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!requireMember(slug, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const members = getDb()
      .memberships.filter((m) => m.projectId === project.id)
      .map((m) => toMemberDto(m.userId, m.role, m.joinedAt));
    return HttpResponse.json({ members });
  }),
];
