import { describe, expect, it } from 'vitest';

import { revisionTags, rowPrefix, treeRows } from '../src/components/forks/tree';
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
    root_id: rootId,
    parent_id: parent,
    category_id: 'cat',
    proposal_kind: 'decision',
    document_name: null,
    is_question: false,
    author_id: 'u',
    title: id,
    body: '',
    voting_rule: 'simple_majority',
    quorum: null,
    status: 'voting',
    created_at: createdAt,
    ends_at: '2026-06-01T00:00:00Z',
    closed_at: null,
    tally_by_choice: {},
    tally_none: 0,
    tally_abstain: 0,
    tally_decisive: 0,
    tally_total: 0,
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

describe('revisionTags', () => {
  const titled = (id: string, title: string, createdAt: string): ExtendedProposal => ({
    ...p(id, null, id, createdAt),
    title,
  });

  it('returns null for titles that are unique in the tree', () => {
    const tree = [
      titled('A', 'Replace the racks', '2026-05-01T00:00:00Z'),
      titled('B', 'Refurbish instead', '2026-05-02T00:00:00Z'),
    ];
    expect(revisionTags(tree)).toEqual({ A: null, B: null });
  });

  it('tags shared titles (r1, r2, …) in creation order', () => {
    const tree = [
      titled('B', 'Adopt the policy', '2026-05-02T00:00:00Z'),
      titled('A', 'Adopt the policy', '2026-05-01T00:00:00Z'),
      titled('C', 'A different one', '2026-05-03T00:00:00Z'),
    ];
    const revs = revisionTags(tree);
    expect(revs.A).toBe('(r1)'); // earliest
    expect(revs.B).toBe('(r2)');
    expect(revs.C).toBeNull(); // unique
  });

  it('is case- and whitespace-insensitive when grouping', () => {
    const tree = [
      titled('A', 'House Rules', '2026-05-01T00:00:00Z'),
      titled('B', '  house rules ', '2026-05-02T00:00:00Z'),
    ];
    const revs = revisionTags(tree);
    expect(revs.A).toBe('(r1)');
    expect(revs.B).toBe('(r2)');
  });
});
