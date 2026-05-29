import { HttpResponse, http } from 'msw';

import {
  documentCurrentVersion,
  documentsForProject,
  getDb,
  type MockProposal,
  projectBySlug,
  proposalsForProject,
} from '../db';
import { autoCloseDuePoll, requireCurrentUser, requireMember } from './_helpers';

const MIN_QUERY_LEN = 2;
const PER_SECTION_CAP = 10;
const SNIPPET_WINDOW = 80;

interface ProposalHitDto {
  id: string;
  title: string;
  snippet: string;
  status: MockProposal['status'];
  proposal_kind: 'decision' | 'document';
}
interface DocumentHitDto {
  name: string;
  version_count: number;
  snippet: string;
}
interface MemberHitDto {
  user_id: string;
  display_name: string;
  role: string;
}
interface ChannelHitDto {
  id: string;
  name: string;
  description: string | null;
}

export interface SearchResultsDto {
  query: string;
  sections: {
    proposals: { hits: ProposalHitDto[]; has_more: boolean };
    documents: { hits: DocumentHitDto[]; has_more: boolean };
    members: { hits: MemberHitDto[]; has_more: boolean };
    channels: { hits: ChannelHitDto[]; has_more: boolean };
  };
}

function emptySections(): SearchResultsDto['sections'] {
  return {
    proposals: { hits: [], has_more: false },
    documents: { hits: [], has_more: false },
    members: { hits: [], has_more: false },
    channels: { hits: [], has_more: false },
  };
}

/** Find the first occurrence of `needle` in `haystack` (case-insensitive)
 *  and return ~SNIPPET_WINDOW chars centred on it. */
function snippetAround(haystack: string, needle: string): string {
  const cleaned = haystack.replace(/\s+/g, ' ').trim();
  const idx = cleaned.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return cleaned.slice(0, SNIPPET_WINDOW);
  const half = Math.floor(SNIPPET_WINDOW / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(cleaned.length, start + SNIPPET_WINDOW);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < cleaned.length ? '…' : '';
  return `${prefix}${cleaned.slice(start, end)}${suffix}`;
}

function recencyOf(p: MockProposal): string {
  return p.closedAt ?? p.createdAt;
}

/** Pure search over the in-memory db. Test target. */
export function runSearch(projectId: string, rawQuery: string): SearchResultsDto {
  const q = rawQuery.trim();
  if (q.length < MIN_QUERY_LEN) return { query: q, sections: emptySections() };
  const qLower = q.toLowerCase();
  const db = getDb();

  const proposalMatches = proposalsForProject(projectId)
    .filter((p) => p.title.toLowerCase().includes(qLower) || p.body.toLowerCase().includes(qLower))
    .sort((a, b) => recencyOf(b).localeCompare(recencyOf(a)));
  const proposalHits = proposalMatches.slice(0, PER_SECTION_CAP).map(
    (p): ProposalHitDto => ({
      id: p.id,
      title: p.title,
      snippet: snippetAround(p.body, q),
      status: p.status,
      proposal_kind: p.proposalKind,
    }),
  );

  const docNames = documentsForProject(projectId);
  const docMatches: { name: string; version: MockProposal }[] = [];
  for (const name of docNames) {
    const current = documentCurrentVersion(projectId, name);
    if (!current) continue;
    const matchInName = name.toLowerCase().includes(qLower);
    const matchInBody = current.body.toLowerCase().includes(qLower);
    if (matchInName || matchInBody) docMatches.push({ name, version: current });
  }
  docMatches.sort((a, b) => (b.version.closedAt ?? '').localeCompare(a.version.closedAt ?? ''));
  const documentHits = docMatches.slice(0, PER_SECTION_CAP).map(
    ({ name, version }): DocumentHitDto => ({
      name,
      version_count: docNames.length,
      snippet: snippetAround(version.body, q),
    }),
  );

  const memberMatches = db.memberships
    .filter((m) => m.projectId === projectId)
    .map((m) => ({ membership: m, user: db.users.get(m.userId) }))
    .filter(
      (x): x is { membership: typeof x.membership; user: NonNullable<typeof x.user> } =>
        !!x.user && x.user.displayName.toLowerCase().includes(qLower),
    )
    .sort((a, b) => a.user.displayName.localeCompare(b.user.displayName));
  const memberHits = memberMatches.slice(0, PER_SECTION_CAP).map(
    ({ user, membership }): MemberHitDto => ({
      user_id: user.userId,
      display_name: user.displayName,
      role: membership.role,
    }),
  );

  const channelMatches = Array.from(db.conversations.values())
    .filter(
      (c): c is Extract<typeof c, { kind: 'channel' }> =>
        c.kind === 'channel' &&
        c.projectId === projectId &&
        (c.name.toLowerCase().includes(qLower) ||
          (c.description ?? '').toLowerCase().includes(qLower)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const channelHits = channelMatches.slice(0, PER_SECTION_CAP).map(
    (c): ChannelHitDto => ({
      id: c.id,
      name: c.name,
      description: c.description ?? null,
    }),
  );

  return {
    query: q,
    sections: {
      proposals: {
        hits: proposalHits,
        has_more: proposalMatches.length > PER_SECTION_CAP,
      },
      documents: {
        hits: documentHits,
        has_more: docMatches.length > PER_SECTION_CAP,
      },
      members: {
        hits: memberHits,
        has_more: memberMatches.length > PER_SECTION_CAP,
      },
      channels: {
        hits: channelHits,
        has_more: channelMatches.length > PER_SECTION_CAP,
      },
    },
  };
}

export const searchHandlers = [
  http.get('*/v1/projects/:slug/search', ({ params, request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!requireMember(slug, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    autoCloseDuePoll(project.id);
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    return HttpResponse.json(runSearch(project.id, q));
  }),
];
