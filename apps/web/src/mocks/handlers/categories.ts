import { HttpResponse, http } from 'msw';

import { mockNowIso } from '../clock';
import {
  addCategory,
  categoriesForProject,
  categoryById,
  findCategoryByName,
  getDb,
  type MockCategory,
  projectBySlug,
  removeCategory,
} from '../db';
import { requireCurrentUser, requireMember, ulid } from './_helpers';

interface CategoryDto {
  id: string;
  name: string;
  position: number;
}

function toDto(c: MockCategory): CategoryDto {
  return { id: c.id, name: c.name, position: c.position };
}

const NAME_MAX = 30;

function validateName(
  raw: string,
): { ok: true; name: string } | { ok: false; status: number; message: string } {
  const name = raw.trim();
  if (name.length === 0) {
    return { ok: false, status: 400, message: 'Name is required.' };
  }
  if (name.length > NAME_MAX) {
    return { ok: false, status: 400, message: `Name must be ${NAME_MAX} characters or fewer.` };
  }
  return { ok: true, name };
}

function canManage(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export const categoriesHandlers = [
  http.get('*/v1/projects/:slug/categories', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!requireMember(slug, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return HttpResponse.json({
      categories: categoriesForProject(project.id).map(toDto),
    });
  }),

  http.post('*/v1/projects/:slug/categories', async ({ params, request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const m = requireMember(slug, me.userId);
    if (!m || !canManage(m.role)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const body = (await request.json()) as { name: string };
    const v = validateName(body.name ?? '');
    if (!v.ok)
      return HttpResponse.json({ error: 'bad_request', message: v.message }, { status: v.status });
    if (findCategoryByName(project.id, v.name)) {
      return HttpResponse.json(
        { error: 'conflict', message: `A category named "${v.name}" already exists.` },
        { status: 409 },
      );
    }
    const existing = categoriesForProject(project.id);
    const id = `cat-${ulid()}`;
    const category: MockCategory = {
      id,
      projectId: project.id,
      name: v.name,
      position: existing.length,
      createdAt: mockNowIso(),
    };
    addCategory(category);
    return HttpResponse.json(toDto(category), { status: 201 });
  }),

  http.patch('*/v1/projects/:slug/categories/:id', async ({ params, request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const m = requireMember(slug, me.userId);
    if (!m || !canManage(m.role)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const cat = categoryById(String(params.id));
    if (!cat || cat.projectId !== project.id) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const body = (await request.json()) as { name: string };
    const v = validateName(body.name ?? '');
    if (!v.ok)
      return HttpResponse.json({ error: 'bad_request', message: v.message }, { status: v.status });
    const dup = findCategoryByName(project.id, v.name);
    if (dup && dup.id !== cat.id) {
      return HttpResponse.json(
        { error: 'conflict', message: `A category named "${v.name}" already exists.` },
        { status: 409 },
      );
    }
    cat.name = v.name;
    getDb().categories.set(cat.id, cat);
    return HttpResponse.json(toDto(cat));
  }),

  http.delete('*/v1/projects/:slug/categories/:id', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const m = requireMember(slug, me.userId);
    if (!m || !canManage(m.role)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const cat = categoryById(String(params.id));
    if (!cat || cat.projectId !== project.id) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const stillReferenced = Array.from(getDb().proposals.values()).some(
      (p) => p.categoryId === cat.id,
    );
    if (stillReferenced) {
      return HttpResponse.json(
        {
          error: 'conflict',
          message: 'Category still has proposals or documents. Re-categorise them first.',
        },
        { status: 409 },
      );
    }
    if (categoriesForProject(project.id).length <= 1) {
      return HttpResponse.json(
        { error: 'conflict', message: 'Project must keep at least one category.' },
        { status: 409 },
      );
    }
    removeCategory(cat.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
