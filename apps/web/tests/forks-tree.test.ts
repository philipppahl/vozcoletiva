import { describe, expect, it } from 'vitest';

import { rowPrefix, treeRows } from '../src/components/forks/tree';
import type { ExtendedProposal } from '../src/lib/proposals/types';

function p(
  id: string,
  parent: string | null,
  rootId: string,
  createdAt = '2026-05-01T00:00:00Z',
): ExtendedProposal {
  return {
    id,
    project_id: 'proj',
    author_id: 'u',
    title: id,
    body: '',
    voting_mode: 'simple_majority',
    quorum: null,
    status: 'voting',
    created_at: createdAt,
    ends_at: '2026-06-01T00:00:00Z',
    closed_at: null,
    tally_yes: 0,
    tally_no: 0,
    tally_abstain: 0,
    voter_count: 0,
    parent_id: parent,
    root_id: rootId,
  };
}

describe('treeRows', () => {
  it('returns an empty array when the root is not in the set', () => {
    expect(treeRows('missing', [])).toEqual([]);
  });

  it('produces depth=0, isLast=true for a lone root', () => {
    const all = [p('a', null, 'a')];
    expect(treeRows('a', all)).toEqual([
      { proposal: all[0], depth: 0, isLast: true, ancestorLasts: [] },
    ]);
  });

  it('handles a linear 3-node chain', () => {
    const all = [
      p('a', null, 'a', '2026-05-01T00:00:00Z'),
      p('b', 'a', 'a', '2026-05-02T00:00:00Z'),
      p('c', 'b', 'a', '2026-05-03T00:00:00Z'),
    ];
    const rows = treeRows('a', all);
    expect(rows.map((r) => r.proposal.id)).toEqual(['a', 'b', 'c']);
    expect(rows.every((r) => r.isLast)).toBe(true);
  });

  it('marks the first sibling at a depth as not-last', () => {
    const all = [
      p('root', null, 'root'),
      p('first', 'root', 'root', '2026-05-01T00:00:00Z'),
      p('second', 'root', 'root', '2026-05-02T00:00:00Z'),
    ];
    const rows = treeRows('root', all);
    expect(rows.map((r) => r.proposal.id)).toEqual(['root', 'first', 'second']);
    expect(rows[1]!.isLast).toBe(false);
    expect(rows[2]!.isLast).toBe(true);
  });

  it('captures ancestorLasts for a depth-3 mixed tree', () => {
    const all = [
      p('R', null, 'R'),
      p('A', 'R', 'R', '2026-05-01T00:00:00Z'),
      p('B', 'R', 'R', '2026-05-02T00:00:00Z'),
      p('A1', 'A', 'R', '2026-05-03T00:00:00Z'),
    ];
    const rows = treeRows('R', all);
    // Order: R (d0), A (d1, not last), A1 (d2, last), B (d1, last)
    expect(rows.map((r) => r.proposal.id)).toEqual(['R', 'A', 'A1', 'B']);
    // A1 sits under A which is NOT the last sibling; ancestorLasts for that
    // column should reflect that so the renderer draws a `│` connector.
    expect(rows[2]!.ancestorLasts).toEqual([true, false]);
  });

  it('rowPrefix returns box-drawing chars consistent with isLast / ancestorLasts', () => {
    const all = [
      p('R', null, 'R'),
      p('A', 'R', 'R', '2026-05-01T00:00:00Z'),
      p('B', 'R', 'R', '2026-05-02T00:00:00Z'),
      p('A1', 'A', 'R', '2026-05-03T00:00:00Z'),
    ];
    const rows = treeRows('R', all);
    expect(rowPrefix(rows[0]!)).toBe('');
    expect(rowPrefix(rows[1]!)).toBe('├─ ');
    expect(rowPrefix(rows[2]!)).toBe('│  └─ ');
    expect(rowPrefix(rows[3]!)).toBe('└─ ');
  });
});
