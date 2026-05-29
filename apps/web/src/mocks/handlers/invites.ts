import { HttpResponse, http } from 'msw';

import { mockNow, mockNowIso } from '../clock';
import { getDb, type MockInvite, projectBySlug } from '../db';
import { requireCurrentUser, requireMember, ulid } from './_helpers';

function isInviteValid(inv: MockInvite): boolean {
  if (inv.revokedAt) return false;
  if (inv.expiresAt && Date.parse(inv.expiresAt) < mockNow()) return false;
  if (inv.maxUses != null && inv.useCount >= inv.maxUses) return false;
  return true;
}

function inviteDto(inv: MockInvite) {
  return {
    id: inv.id,
    project_id: inv.projectId,
    code: inv.code,
    token: inv.token,
    role: inv.role,
    issued_by: inv.issuedBy,
    issued_at: inv.issuedAt,
    expires_at: inv.expiresAt ?? null,
    max_uses: inv.maxUses ?? null,
    use_count: inv.useCount,
    revoked_at: inv.revokedAt ?? null,
    note: inv.note ?? null,
  };
}

function previewDto(inv: MockInvite) {
  const project = getDb().projects.get(inv.projectId);
  return {
    project_name: project?.name ?? 'Unknown project',
    project_slug: project?.slug ?? '',
    role: inv.role,
    expires_at: inv.expiresAt ?? null,
    max_uses: inv.maxUses ?? null,
    use_count: inv.useCount,
    revoked: inv.revokedAt != null,
    valid: isInviteValid(inv),
  };
}

export const invitesHandlers = [
  http.get('*/v1/projects/:slug/invites', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const m = requireMember(slug, me.userId);
    if (!m) return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    const invites = Array.from(getDb().invites.values())
      .filter((i) => i.projectId === project.id)
      .map(inviteDto);
    return HttpResponse.json({ invites });
  }),

  http.post('*/v1/projects/:slug/invites', async ({ params, request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const m = requireMember(slug, me.userId);
    if (!m || (m.role !== 'owner' && m.role !== 'admin')) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const body = (await request.json()) as {
      role: 'member' | 'observer' | 'moderator';
      expires_in_days?: number;
      max_uses?: number;
      note?: string;
    };
    const id = ulid();
    const code = Math.random()
      .toString(36)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8)
      .padEnd(8, 'X');
    const inv: MockInvite = {
      id,
      projectId: project.id,
      code,
      token: `tok_${code}`,
      role: body.role,
      issuedBy: me.userId,
      issuedAt: mockNowIso(),
      expiresAt: body.expires_in_days
        ? new Date(mockNow() + body.expires_in_days * 86_400_000).toISOString()
        : null,
      maxUses: body.max_uses ?? null,
      useCount: 0,
      note: body.note ?? null,
    };
    getDb().invites.set(id, inv);
    return HttpResponse.json(inviteDto(inv), { status: 201 });
  }),

  http.delete('*/v1/projects/:slug/invites/:inviteId', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const m = requireMember(slug, me.userId);
    if (!m || (m.role !== 'owner' && m.role !== 'admin')) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const inv = getDb().invites.get(String(params.inviteId));
    if (!inv) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    inv.revokedAt = mockNowIso();
    return HttpResponse.json({ ok: true });
  }),

  http.get('*/v1/invites/:token', ({ params }) => {
    const inv = Array.from(getDb().invites.values()).find((i) => i.token === String(params.token));
    if (!inv) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    return HttpResponse.json(previewDto(inv));
  }),

  http.get('*/v1/invites/by-code/:code', ({ params }) => {
    const code = String(params.code).toUpperCase();
    const inv = Array.from(getDb().invites.values()).find((i) => i.code === code);
    if (!inv) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    return HttpResponse.json(previewDto(inv));
  }),

  http.post('*/v1/invites/:token/accept', ({ params }) => acceptByToken(String(params.token))),
  http.post('*/v1/invites/by-code/:code/accept', ({ params }) => acceptByCode(String(params.code))),
];

function acceptByToken(token: string) {
  const inv = Array.from(getDb().invites.values()).find((i) => i.token === token);
  return acceptCommon(inv);
}
function acceptByCode(code: string) {
  const inv = Array.from(getDb().invites.values()).find((i) => i.code === code.toUpperCase());
  return acceptCommon(inv);
}

function acceptCommon(inv: MockInvite | undefined) {
  if (!inv) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
  const me = requireCurrentUser();
  if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isInviteValid(inv)) {
    return HttpResponse.json(
      { error: 'conflict', message: 'Invite no longer valid' },
      { status: 409 },
    );
  }
  const db = getDb();
  const existing = db.memberships.find(
    (x) => x.projectId === inv.projectId && x.userId === me.userId,
  );
  if (!existing) {
    db.memberships.push({
      projectId: inv.projectId,
      userId: me.userId,
      role: inv.role,
      joinedAt: mockNowIso(),
    });
    inv.useCount += 1;
  }
  const project = db.projects.get(inv.projectId)!;
  return HttpResponse.json({
    project: { id: project.id, name: project.name, slug: project.slug },
    role: inv.role,
  });
}
