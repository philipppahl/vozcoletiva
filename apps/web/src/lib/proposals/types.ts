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

export type ExtendedProposal = components['schemas']['Proposal'] & {
  parent_id?: string | null;
  root_id: string;
  proposal_kind?: ProposalKind | null;
  document_name?: string | null;
  voting_rule?: VotingRule | null;
  /** Per-alternative vote count for the whole deliberation. Key = alternative
   *  proposal id; value = number of voters who picked it. */
  tally_by_choice?: Record<string, number>;
  /** Votes for "none of these". */
  tally_none?: number;
  /** Total decisive (= alternative or "none of these") votes. */
  tally_decisive?: number;
  /** Caller's actual root-level choice. Proposal id, VOTE_NONE, VOTE_ABSTAIN,
   *  or null if not voted yet. */
  your_root_choice?: string | null;
  /** Project-scoped category this proposal belongs to. */
  category_id?: string | null;
  /** True on the root of a multi-option decision — frames the question but is
   *  not itself a votable choice. */
  is_question?: boolean | null;
};

export interface ExtendedProposalListResponse {
  proposals: ExtendedProposal[];
}
