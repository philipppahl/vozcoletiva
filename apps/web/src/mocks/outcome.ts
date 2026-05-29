/**
 * Pure outcome computation for a closed deliberation.
 *
 * Voting model (see docs/decisions/0005-voting-model-simplified.md):
 *   - Each user casts one vote per deliberation. The vote's `choice` is the
 *     picked alternative's proposal id, or VOTE_NONE / VOTE_ABSTAIN.
 *   - Four rules: plurality / simple_majority / two_thirds / consensus.
 *   - Quorum is an optional minimum participation (total of decisive votes).
 *
 * `decideOutcome` returns the winning proposal id (or null), plus a status
 * label for the deliberation. The caller is responsible for setting the
 * status field on each proposal in the tree (winner → 'passed', losers →
 * 'rejected', everything → 'quorum_failed' if quorum failed).
 */

import { type DeliberationTally, type MockProposal, VOTE_NONE, type VotingRule } from './db';

export type OutcomeStatus = 'has_winner' | 'no_winner' | 'quorum_failed';

export interface OutcomeResult {
  winnerId: string | null;
  status: OutcomeStatus;
}

export function decideOutcome(
  tree: MockProposal[],
  tally: DeliberationTally,
  rule: VotingRule,
  quorum: number | null | undefined,
): OutcomeResult {
  if (quorum != null && tally.decisive < quorum) {
    return { winnerId: null, status: 'quorum_failed' };
  }
  if (tally.decisive === 0) {
    return { winnerId: null, status: 'no_winner' };
  }
  const validAlternativeIds = new Set(tree.map((p) => p.id));
  const ranked = Object.entries(tally.byChoice)
    .filter(([id]) => validAlternativeIds.has(id))
    .sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    // Everyone who voted picked "none of these".
    return { winnerId: null, status: 'no_winner' };
  }
  const [topId, topCount] = ranked[0]!;
  const second = ranked[1]?.[1] ?? 0;
  // "None of these" competes against alternatives — if more voters picked
  // none than the leading alternative, no alternative wins.
  if (tally.none > topCount) {
    return { winnerId: null, status: 'no_winner' };
  }
  const tied = topCount === second || topCount === tally.none;

  switch (rule) {
    case 'plurality': {
      if (tied) return { winnerId: null, status: 'no_winner' };
      return { winnerId: topId, status: 'has_winner' };
    }
    case 'simple_majority': {
      if (topCount * 2 <= tally.decisive) return { winnerId: null, status: 'no_winner' };
      return { winnerId: topId, status: 'has_winner' };
    }
    case 'two_thirds': {
      if (topCount * 3 < tally.decisive * 2) return { winnerId: null, status: 'no_winner' };
      return { winnerId: topId, status: 'has_winner' };
    }
    case 'consensus': {
      // All decisive votes must converge on the same alternative — i.e. no
      // one picked another alternative AND no one picked "none of these".
      // Abstain is silence-is-consent, so it doesn't disqualify.
      if (tally.none > 0) return { winnerId: null, status: 'no_winner' };
      if (ranked.length > 1) return { winnerId: null, status: 'no_winner' };
      return { winnerId: topId, status: 'has_winner' };
    }
  }
}

// Re-export the special vote tokens so the outcome consumers don't need a
// separate import.
export { VOTE_NONE };
