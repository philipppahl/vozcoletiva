import { describe, expect, it } from 'vitest';

import type { DeliberationTally, MockProposal } from '../src/mocks/db';
import { VOTE_ABSTAIN, VOTE_NONE } from '../src/mocks/db';
import { decideOutcome } from '../src/mocks/outcome';

function tree(...ids: string[]): MockProposal[] {
  return ids.map(
    (id) =>
      ({
        id,
        projectId: 'p',
        authorId: 'u',
        title: id,
        body: '',
        votingRule: 'simple_majority',
        quorum: null,
        status: 'voting',
        createdAt: '2026-01-01T00:00:00Z',
        endsAt: '2026-01-02T00:00:00Z',
        closedAt: null,
        parentId: ids[0] === id ? null : ids[0]!,
        rootId: ids[0]!,
        proposalKind: 'decision',
      }) as MockProposal,
  );
}

function tally(byChoice: Record<string, number>, none = 0, abstain = 0): DeliberationTally {
  const decisive = Object.values(byChoice).reduce((s, n) => s + n, 0) + none;
  return { byChoice, none, abstain, decisive, total: decisive + abstain };
}

describe('decideOutcome', () => {
  describe('plurality', () => {
    it('picks the option with the most votes', () => {
      const r = decideOutcome(tree('a', 'b', 'c'), tally({ a: 5, b: 3, c: 1 }), 'plurality', null);
      expect(r.winnerId).toBe('a');
      expect(r.status).toBe('has_winner');
    });
    it('returns no winner on a tie', () => {
      const r = decideOutcome(tree('a', 'b'), tally({ a: 3, b: 3 }), 'plurality', null);
      expect(r.winnerId).toBeNull();
      expect(r.status).toBe('no_winner');
    });
    it('no winner when "none of these" leads', () => {
      const r = decideOutcome(tree('a', 'b'), tally({ a: 2, b: 1 }, 5), 'plurality', null);
      expect(r.winnerId).toBeNull();
    });
  });

  describe('simple_majority', () => {
    it('needs more than 50% of decisive', () => {
      const r = decideOutcome(tree('a', 'b'), tally({ a: 6, b: 4 }), 'simple_majority', null);
      expect(r.winnerId).toBe('a');
    });
    it('fails at exactly 50%', () => {
      const r = decideOutcome(tree('a', 'b'), tally({ a: 5, b: 5 }), 'simple_majority', null);
      expect(r.winnerId).toBeNull();
    });
  });

  describe('two_thirds', () => {
    it('passes at exactly 2/3', () => {
      const r = decideOutcome(tree('a', 'b'), tally({ a: 6, b: 3 }), 'two_thirds', null);
      expect(r.winnerId).toBe('a');
    });
    it('fails just below 2/3', () => {
      const r = decideOutcome(tree('a', 'b'), tally({ a: 5, b: 3 }), 'two_thirds', null);
      expect(r.winnerId).toBeNull();
    });
  });

  describe('consensus', () => {
    it('passes when every decisive vote picked the same alternative', () => {
      const r = decideOutcome(tree('a'), tally({ a: 4 }, 0, 2), 'consensus', null);
      expect(r.winnerId).toBe('a');
    });
    it('fails when anyone picked "none of these"', () => {
      const r = decideOutcome(tree('a'), tally({ a: 4 }, 1), 'consensus', null);
      expect(r.winnerId).toBeNull();
    });
    it('fails when votes split across alternatives', () => {
      const r = decideOutcome(tree('a', 'b'), tally({ a: 4, b: 1 }), 'consensus', null);
      expect(r.winnerId).toBeNull();
    });
  });

  describe('quorum', () => {
    it('reports quorum_failed when decisive votes are below quorum', () => {
      const r = decideOutcome(tree('a'), tally({ a: 3 }, 0, 0), 'simple_majority', 8);
      expect(r.status).toBe('quorum_failed');
      expect(r.winnerId).toBeNull();
    });
    it('passes the threshold check once quorum is met', () => {
      const r = decideOutcome(tree('a'), tally({ a: 8 }), 'simple_majority', 8);
      expect(r.status).toBe('has_winner');
    });
  });

  it('returns no_winner when nobody voted decisively', () => {
    const r = decideOutcome(tree('a'), tally({}, 0, 3), 'plurality', null);
    expect(r.status).toBe('no_winner');
  });

  it('ignores votes for proposal ids outside the tree (e.g. a stale fork)', () => {
    const r = decideOutcome(
      tree('a', 'b'),
      tally({ a: 4, b: 1, 'ghost-id': 99 }),
      'plurality',
      null,
    );
    expect(r.winnerId).toBe('a');
  });
});

describe('VOTE constants', () => {
  it('are stable strings', () => {
    expect(VOTE_NONE).toBe('__none__');
    expect(VOTE_ABSTAIN).toBe('__abstain__');
  });
});
