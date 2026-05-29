import { HttpResponse, http } from 'msw';

import { mockNowIso } from '../clock';
import { getDb, projectBySlug, treeFlat, VOTE_ABSTAIN, VOTE_NONE } from '../db';
import { requireCurrentUser, requireMember, toProposalDto } from './_helpers';

/**
 * Vote endpoints accept any proposal in a deliberation tree as the URL id;
 * the vote is always recorded at the root. The request body's `choice` is
 * either a proposal id of an alternative in the tree, or one of the special
 * tokens `__none__` / `__abstain__`. Legacy choices ('yes' / 'no' / 'abstain')
 * are still accepted and mapped onto the new shape so that older clients keep
 * working during the transition.
 */
export const votesHandlers = [
  http.post('*/v1/projects/:slug/proposals/:id/vote', async ({ params, request }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const project = projectBySlug(String(params.slug));
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const m = requireMember(String(params.slug), me.userId);
    if (!m || m.role === 'observer') {
      return HttpResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const proposal = getDb().proposals.get(String(params.id));
    if (!proposal || proposal.projectId !== project.id) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const root = getDb().proposals.get(proposal.rootId) ?? proposal;
    if (root.status !== 'voting') {
      return HttpResponse.json({ error: 'conflict', message: 'Voting closed' }, { status: 409 });
    }
    const raw = (await request.json()) as { choice: string };
    const choice = normaliseChoice(raw.choice, proposal.id);

    // Validate: choice must be an alternative in the tree, or a special token.
    if (choice !== VOTE_NONE && choice !== VOTE_ABSTAIN) {
      const tree = treeFlat(root.id);
      if (!tree.some((p) => p.id === choice)) {
        return HttpResponse.json(
          { error: 'bad_request', message: 'choice is not an alternative in this deliberation' },
          { status: 400 },
        );
      }
    }

    const db = getDb();
    const idx = db.votes.findIndex((v) => v.rootId === root.id && v.userId === me.userId);
    if (idx >= 0) {
      db.votes[idx] = { rootId: root.id, userId: me.userId, choice, at: mockNowIso() };
    } else {
      db.votes.push({ rootId: root.id, userId: me.userId, choice, at: mockNowIso() });
    }
    return HttpResponse.json(toProposalDto(proposal, me.userId));
  }),

  http.delete('*/v1/projects/:slug/proposals/:id/vote', ({ params }) => {
    const me = requireCurrentUser();
    if (!me) return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    const project = projectBySlug(String(params.slug));
    if (!project) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const proposal = getDb().proposals.get(String(params.id));
    if (!proposal || proposal.projectId !== project.id) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const db = getDb();
    db.votes = db.votes.filter((v) => !(v.rootId === proposal.rootId && v.userId === me.userId));
    return HttpResponse.json(toProposalDto(proposal, me.userId));
  }),
];

/** Map legacy `yes` / `no` / `abstain` onto the new vote shape, keyed off the
 *  proposal whose URL was used. `yes` becomes "I picked this proposal";
 *  `no` becomes "none of these"; `abstain` is just abstain. */
function normaliseChoice(raw: string, proposalIdFromUrl: string): string {
  if (raw === 'yes') return proposalIdFromUrl;
  if (raw === 'no') return VOTE_NONE;
  if (raw === 'abstain') return VOTE_ABSTAIN;
  return raw;
}
