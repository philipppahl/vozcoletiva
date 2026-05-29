import { HttpResponse, http } from 'msw';

import { mockNow, mockNowIso } from '../clock';
import {
  activeDocumentDeliberation,
  categoryById,
  defaultCategoryFor,
  documentCurrentVersion,
  getDb,
  type MockProposal,
  type ProposalKind,
  projectBySlug,
  proposalsForProject,
  treeFlat,
  type VotingRule,
} from '../db';
import {
  autoCloseDuePoll,
  requireCurrentUser,
  requireMember,
  toProposalDto,
  ulid,
} from './_helpers';

const VALID_RULES: VotingRule[] = ['plurality', 'simple_majority', 'two_thirds', 'consensus'];

export const proposalsHandlers = [
  http.get('*/v1/projects/:slug/proposals', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!requireMember(slug, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    autoCloseDuePoll(project.id);
    const proposals = proposalsForProject(project.id).map((p) => toProposalDto(p, me.userId));
    return HttpResponse.json({ proposals });
  }),

  http.post('*/v1/projects/:slug/proposals', async ({ params, request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const m = requireMember(slug, me.userId);
    if (!m || m.role === 'observer') {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const body = (await request.json()) as {
      title: string;
      body: string;
      voting_rule?: VotingRule;
      // Legacy field accepted for back-compat with older callers.
      voting_mode?: 'simple_majority' | 'qualified_two_thirds';
      ends_at: string;
      quorum?: number | null;
      parent_id?: string | null;
      proposal_kind?: ProposalKind | null;
      document_name?: string | null;
      category_id?: string | null;
    };
    // Resolve the voting rule from either the new or legacy field.
    let votingRule: VotingRule =
      body.voting_rule && VALID_RULES.includes(body.voting_rule)
        ? body.voting_rule
        : body.voting_mode === 'qualified_two_thirds'
          ? 'two_thirds'
          : 'simple_majority';
    let quorum = body.quorum ?? null;
    let parentId: string | null = null;
    let rootId: string;
    let endsAt = body.ends_at;
    let proposalKind: ProposalKind = body.proposal_kind ?? 'decision';
    let documentName = body.document_name?.trim() || null;
    let categoryId: string | null = null;
    if (body.parent_id) {
      const parent = getDb().proposals.get(body.parent_id);
      if (!parent || parent.projectId !== project.id) {
        return HttpResponse.json(
          { error: 'not_found', message: 'Parent proposal not found' },
          { status: 404 },
        );
      }
      if (parent.status !== 'voting') {
        return HttpResponse.json(
          { error: 'conflict', message: 'Cannot fork a closed proposal' },
          { status: 409 },
        );
      }
      parentId = parent.id;
      rootId = parent.rootId;
      // Forks inherit the root's voting rule, quorum, ends_at, kind and
      // document name. Whatever the client sent for those is ignored.
      const root = getDb().proposals.get(parent.rootId) ?? parent;
      votingRule = root.votingRule;
      quorum = root.quorum ?? null;
      endsAt = root.endsAt;
      proposalKind = root.proposalKind;
      documentName = root.documentName ?? null;
      categoryId = root.categoryId; // forks inherit category
    } else {
      rootId = ''; // assigned to id below
      if (proposalKind === 'document') {
        if (!documentName) {
          return HttpResponse.json(
            { error: 'bad_request', message: 'Document proposals require document_name' },
            { status: 400 },
          );
        }
        // Enforce "at most one active Document deliberation per document name".
        const active = activeDocumentDeliberation(project.id, documentName);
        if (active) {
          return HttpResponse.json(
            {
              error: 'conflict',
              message: `An active deliberation already exists for "${documentName}". Fork it to propose an alternative, or wait for it to close.`,
            },
            { status: 409 },
          );
        }
        // Amendments inherit the document's current category.
        const current = documentCurrentVersion(project.id, documentName);
        if (current) categoryId = current.categoryId;
      }
      if (!categoryId) {
        // Brand-new root: take what the client sent, else fall back to default.
        if (body.category_id) {
          const cat = categoryById(body.category_id);
          if (!cat || cat.projectId !== project.id) {
            return HttpResponse.json(
              { error: 'bad_request', message: 'category_id is not a category in this project' },
              { status: 400 },
            );
          }
          categoryId = cat.id;
        } else {
          categoryId = defaultCategoryFor(project.id)?.id ?? null;
        }
      }
      if (!categoryId) {
        return HttpResponse.json(
          { error: 'bad_request', message: 'Project has no categories' },
          { status: 400 },
        );
      }
    }
    const id = ulid();
    if (!parentId) rootId = id;
    const proposal: MockProposal = {
      id,
      projectId: project.id,
      authorId: me.userId,
      title: body.title,
      body: body.body,
      votingRule,
      quorum,
      status: 'voting',
      createdAt: mockNowIso(),
      endsAt,
      closedAt: null,
      parentId,
      rootId,
      proposalKind,
      documentName,
      categoryId: categoryId!,
    };
    getDb().proposals.set(id, proposal);
    return HttpResponse.json(toProposalDto(proposal, me.userId), { status: 201 });
  }),

  http.get('*/v1/projects/:slug/proposals/:id/tree', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const project = projectBySlug(String(params.slug));
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!requireMember(String(params.slug), me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    autoCloseDuePoll(project.id);
    const proposal = getDb().proposals.get(String(params.id));
    if (!proposal || proposal.projectId !== project.id) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const proposals = treeFlat(proposal.rootId).map((p) => toProposalDto(p, me.userId));
    return HttpResponse.json({ proposals });
  }),

  http.get('*/v1/projects/:slug/proposals/:id', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const slug = String(params.slug);
    const project = projectBySlug(slug);
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (!requireMember(slug, me.userId)) {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    autoCloseDuePoll(project.id);
    const p = getDb().proposals.get(String(params.id));
    if (!p || p.projectId !== project.id)
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    return HttpResponse.json(toProposalDto(p, me.userId));
  }),

  http.post('*/v1/projects/:slug/proposals/:id/withdraw', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const project = projectBySlug(String(params.slug));
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const p = getDb().proposals.get(String(params.id));
    if (!p || p.projectId !== project.id)
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    if (p.authorId !== me.userId) return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    if (p.status !== 'voting') return HttpResponse.json({ error: 'conflict' }, { status: 409 });
    p.status = 'withdrawn';
    p.closedAt = new Date(mockNow()).toISOString();
    return HttpResponse.json(toProposalDto(p, me.userId));
  }),
];
