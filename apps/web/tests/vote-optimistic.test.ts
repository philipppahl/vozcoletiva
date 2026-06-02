import { describe, expect, it } from 'vitest';

import { VOTE_ABSTAIN, VOTE_NONE } from '../src/lib/proposals/types';
import { applyRetract, applyVote } from '../src/lib/proposals/voteOptimistic';

// Minimal tally-bearing object; the transforms only touch the tally fields.
// biome-ignore lint/suspicious/noExplicitAny: test fixture stands in for ExtendedProposal
function tally(over: Record<string, unknown> = {}): any {
  return {
    your_choice: undefined,
    tally_by_choice: {},
    tally_none: 0,
    tally_abstain: 0,
    tally_decisive: 0,
    tally_total: 0,
    ...over,
  };
}

describe('applyVote', () => {
  it('casts a fresh pick', () => {
    const r = applyVote(tally(), 'p1');
    expect(r.your_choice).toBe('p1');
    expect(r.tally_by_choice).toEqual({ p1: 1 });
    expect(r.tally_decisive).toBe(1);
    expect(r.tally_total).toBe(1);
  });

  it('moves a pick from one option to another', () => {
    const r = applyVote(
      tally({
        your_choice: 'p1',
        tally_by_choice: { p1: 3, p2: 1 },
        tally_decisive: 4,
        tally_total: 4,
      }),
      'p2',
    );
    expect(r.tally_by_choice).toEqual({ p1: 2, p2: 2 });
    expect(r.tally_decisive).toBe(4);
    expect(r.your_choice).toBe('p2');
  });

  it('switches a pick to abstain — decisive drops, total holds', () => {
    const r = applyVote(
      tally({ your_choice: 'p1', tally_by_choice: { p1: 1 }, tally_decisive: 1, tally_total: 1 }),
      VOTE_ABSTAIN,
    );
    expect(r.tally_by_choice).toEqual({ p1: 0 });
    expect(r.tally_abstain).toBe(1);
    expect(r.tally_decisive).toBe(0);
    expect(r.tally_total).toBe(1);
  });

  it('switches abstain to none — decisive + total rise', () => {
    const r = applyVote(
      tally({ your_choice: VOTE_ABSTAIN, tally_abstain: 1, tally_total: 1 }),
      VOTE_NONE,
    );
    expect(r.tally_none).toBe(1);
    expect(r.tally_abstain).toBe(0);
    expect(r.tally_decisive).toBe(1);
    expect(r.tally_total).toBe(1);
  });

  it('re-affirming the same choice is a no-op', () => {
    const before = tally({
      your_choice: 'p1',
      tally_by_choice: { p1: 2 },
      tally_decisive: 2,
      tally_total: 2,
    });
    const r = applyVote(before, 'p1');
    expect(r.tally_by_choice).toEqual({ p1: 2 });
    expect(r.tally_decisive).toBe(2);
  });
});

describe('applyRetract', () => {
  it('removes the viewer pick', () => {
    const r = applyRetract(
      tally({
        your_choice: 'p1',
        tally_by_choice: { p1: 1, p2: 2 },
        tally_decisive: 3,
        tally_total: 3,
      }),
    );
    expect(r.your_choice).toBeUndefined();
    expect(r.tally_by_choice).toEqual({ p1: 0, p2: 2 });
    expect(r.tally_decisive).toBe(2);
    expect(r.tally_total).toBe(2);
  });

  it('removes an abstain', () => {
    const r = applyRetract(tally({ your_choice: VOTE_ABSTAIN, tally_abstain: 1, tally_total: 1 }));
    expect(r.tally_abstain).toBe(0);
    expect(r.tally_total).toBe(0);
  });
});
