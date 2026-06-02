import type { ExtendedProposal } from './types';
import { VOTE_ABSTAIN, VOTE_NONE } from './types';

/**
 * Pure optimistic tally transforms (decision 0026). Mirror the server's
 * per-deliberation vote accounting so the tally + your-choice flip instantly;
 * the server reconciles on settle.
 */

type Tally = Pick<
  ExtendedProposal,
  | 'your_choice'
  | 'tally_by_choice'
  | 'tally_none'
  | 'tally_abstain'
  | 'tally_decisive'
  | 'tally_total'
>;

function withCounts<T extends Tally>(p: T, prev: string | undefined, next: string | undefined): T {
  const byChoice = { ...p.tally_by_choice };
  let none = p.tally_none;
  let abstain = p.tally_abstain;
  const dec = (c: string | undefined) => {
    if (!c) return;
    if (c === VOTE_NONE) none = Math.max(0, none - 1);
    else if (c === VOTE_ABSTAIN) abstain = Math.max(0, abstain - 1);
    else byChoice[c] = Math.max(0, (byChoice[c] ?? 0) - 1);
  };
  const inc = (c: string | undefined) => {
    if (!c) return;
    if (c === VOTE_NONE) none += 1;
    else if (c === VOTE_ABSTAIN) abstain += 1;
    else byChoice[c] = (byChoice[c] ?? 0) + 1;
  };
  if (prev !== next) {
    dec(prev);
    inc(next);
  }
  const decisive = Object.values(byChoice).reduce((a, b) => a + b, 0) + none;
  return {
    ...p,
    your_choice: next as ExtendedProposal['your_choice'],
    tally_by_choice: byChoice,
    tally_none: none,
    tally_abstain: abstain,
    tally_decisive: decisive,
    tally_total: decisive + abstain,
  };
}

/** Optimistically cast/change the viewer's vote to `next`. */
export function applyVote<T extends Tally>(p: T, next: string): T {
  return withCounts(p, p.your_choice ?? undefined, next);
}

/** Optimistically retract the viewer's vote. */
export function applyRetract<T extends Tally>(p: T): T {
  return withCounts(p, p.your_choice ?? undefined, undefined);
}
