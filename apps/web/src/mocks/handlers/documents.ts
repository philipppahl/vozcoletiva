import { HttpResponse, http } from 'msw';

import {
  activeDocumentDeliberation,
  documentCurrentVersion,
  documentsForProject,
  documentVersions,
  projectBySlug,
} from '../db';
import { autoCloseDuePoll, requireCurrentUser, requireMember, toProposalDto } from './_helpers';

/**
 * Documents are a derived view over proposals — there is no Document or
 * DocumentVersion entity. See docs/decisions/0004-documents-mock-first.md.
 *
 * Endpoints in this slice:
 *   GET /v1/projects/{slug}/documents             — list of distinct document
 *                                                   names with their current
 *                                                   version preview + active
 *                                                   amendment, if any.
 *   GET /v1/projects/{slug}/documents/by-name/{name}
 *       — full detail: current version + version history + active amendment.
 */
export const documentsHandlers = [
  http.get('*/v1/projects/:slug/documents', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!requireMember(slug, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    autoCloseDuePoll(project.id);

    const names = documentsForProject(project.id);
    const documents = names.map((name) => {
      const current = documentCurrentVersion(project.id, name);
      const versions = documentVersions(project.id, name);
      const active = activeDocumentDeliberation(project.id, name);
      return {
        name,
        version_count: versions.length,
        current_version: current ? toProposalDto(current, me.userId) : null,
        active_amendment: active ? toProposalDto(active, me.userId) : null,
      };
    });
    return HttpResponse.json({ documents });
  }),

  http.get('*/v1/projects/:slug/documents/by-name/:name', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!requireMember(slug, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    autoCloseDuePoll(project.id);
    const name = decodeURIComponent(String(params.name));
    const versions = documentVersions(project.id, name);
    const current = versions[0];
    if (!current) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const active = activeDocumentDeliberation(project.id, name);
    return HttpResponse.json({
      name,
      version_count: versions.length,
      current_version: toProposalDto(current, me.userId),
      versions: versions.map((v) => toProposalDto(v, me.userId)),
      active_amendment: active ? toProposalDto(active, me.userId) : null,
    });
  }),
];
