import { beforeEach, describe, expect, it } from 'vitest';

import { childrenOf, getDb, rootOf, treeFlat } from '../src/mocks/db';
import { seed } from '../src/mocks/seed';

beforeEach(() => seed({ identityKey: 'marina' }));

describe('mock tree helpers', () => {
  it('marks pr-bike-racks as a root with the refurb child', () => {
    const root = getDb().proposals.get('pr-bike-racks');
    const child = getDb().proposals.get('pr-bike-refurb');
    expect(root?.parentId).toBeNull();
    expect(root?.rootId).toBe('pr-bike-racks');
    expect(child?.parentId).toBe('pr-bike-racks');
    expect(child?.rootId).toBe('pr-bike-racks');
    // Forks inherit the root's voting rule, kind, etc.
    expect(child?.votingRule).toBe(root?.votingRule);
    expect(child?.endsAt).toBe(root?.endsAt);
  });

  it('marks pr-solar with three alternatives', () => {
    const kids = childrenOf('pr-solar');
    expect(kids.map((p) => p.id).sort()).toEqual(
      ['pr-solar-20', 'pr-solar-20-reserve', 'pr-solar-lease'].sort(),
    );
  });

  it('treeFlat returns root + descendants in created-at order', () => {
    const flat = treeFlat('pr-solar');
    expect(flat[0]!.id).toBe('pr-solar');
    expect(flat.length).toBe(4);
  });

  it('rootOf walks the parent chain', () => {
    const child = getDb().proposals.get('pr-bike-refurb')!;
    expect(rootOf(child).id).toBe('pr-bike-racks');
  });
});
