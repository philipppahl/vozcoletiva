import type { components } from '@vozcoletiva/api-client';

/**
 * FE-side extension of the wire-level Proposal. The mock layer already
 * returns these fields; the real OpenAPI spec will catch up in a later
 * slice. See `docs/decisions/0005-voting-model-simplified.md` and
 * `docs/decisions/0004-documents-mock-first.md`.
 */

export type VotingRule = 'plurality' | 'simple_majority' | 'two_thirds' | 'consensus';
export type ProposalKind = 'decision' | 'document';

/** Special vote tokens echoed from the server alongside per-alternative ids. */
export const VOTE_NONE = '__none__';
export const VOTE_ABSTAIN = '__abstain__';

/**
 * The wire-level Proposal. The OpenAPI spec now carries every field the FE
 * needs (root_id, parent_id, proposal_kind, document_name, voting_rule,
 * tally_by_choice/none/abstain/decisive/total, is_question, category_id,
 * your_choice), so this is a straight alias kept for import stability.
 */
export type ExtendedProposal = components['schemas']['Proposal'];

export interface ExtendedProposalListResponse {
  proposals: ExtendedProposal[];
}
