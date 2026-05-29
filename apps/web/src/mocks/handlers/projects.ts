import { HttpResponse, http } from 'msw';

import { mockNowIso } from '../clock';
import { getDb, membershipOf, projectBySlug } from '../db';
import { projectListForViewer, requireCurrentUser, toProjectDto, ulid } from './_helpers';

export const projectsHandlers = [
  http.get('*/v1/projects', () => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const projects = projectListForViewer(me.userId).map(({ project, role }) => ({
      project: toProjectDto(project),
      role,
    }));
    return HttpResponse.json({ projects });
  }),

  http.post('*/v1/projects', async ({ request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = (await request.json()) as { name: string; slug: string; template?: string };
    const db = getDb();
    if (projectBySlug(body.slug)) {
      return HttpResponse.json(
        { error: 'conflict', message: 'A project with this slug already exists.' },
        { status: 409 },
      );
    }
    const id = ulid();
    const project = {
      id,
      name: body.name,
      slug: body.slug,
      ownerId: me.userId,
      template: body.template ?? 'custom',
      visibility: 'private' as const,
      createdAt: mockNowIso(),
    };
    db.projects.set(id, project);
    db.memberships.push({
      projectId: id,
      userId: me.userId,
      role: 'owner',
      joinedAt: project.createdAt,
    });
    return HttpResponse.json(toProjectDto(project), { status: 201 });
  }),

  http.get('*/v1/projects/:slug', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const m = membershipOf(project.id, me.userId);
    if (!m) return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    return HttpResponse.json({ project: toProjectDto(project), role: m.role });
  }),
];
