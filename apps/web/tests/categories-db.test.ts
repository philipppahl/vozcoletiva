import { beforeEach, describe, expect, it } from 'vitest';

import {
  addCategory,
  categoriesForProject,
  defaultCategoryFor,
  findCategoryByName,
  getDb,
  removeCategory,
} from '../src/mocks/db';
import { seed } from '../src/mocks/seed';

beforeEach(() => seed({ identityKey: 'marina' }));

describe('category db helpers', () => {
  it('every project starts with one "Commons" category', () => {
    expect(categoriesForProject('p-vmc').map((c) => c.name)).toEqual(['Commons']);
    expect(categoriesForProject('p-fsbr').map((c) => c.name)).toEqual(['Commons']);
    expect(categoriesForProject('p-ndc').map((c) => c.name)).toEqual(['Commons']);
  });

  it('every seeded proposal has a categoryId pointing at the project Commons', () => {
    for (const p of getDb().proposals.values()) {
      expect(p.categoryId).toBe(`cat-${p.projectId}-commons`);
    }
  });

  it('defaultCategoryFor returns the position-0 category', () => {
    const def = defaultCategoryFor('p-vmc');
    expect(def?.name).toBe('Commons');
  });

  it('findCategoryByName is case-insensitive', () => {
    expect(findCategoryByName('p-vmc', 'commons')?.name).toBe('Commons');
    expect(findCategoryByName('p-vmc', 'COMMONS')?.name).toBe('Commons');
    expect(findCategoryByName('p-vmc', 'nope')).toBeUndefined();
  });

  it('addCategory appends with the next position', () => {
    addCategory({
      id: 'cat-test-finance',
      projectId: 'p-vmc',
      name: 'Finance',
      position: categoriesForProject('p-vmc').length,
      createdAt: '2026-05-21T00:00:00Z',
    });
    expect(categoriesForProject('p-vmc').map((c) => c.name)).toEqual(['Commons', 'Finance']);
  });

  it('removeCategory rejects when proposals still reference it', () => {
    const id = `cat-p-vmc-commons`;
    expect(removeCategory(id)).toBe(false);
    expect(categoriesForProject('p-vmc').length).toBe(1);
  });

  it('removeCategory rejects when it would leave the project empty', () => {
    // First add a second category, then move all proposals to it, then try
    // to delete that one — should be rejected because Commons still has refs.
    // Direct test of the "last one" rule needs a clean project; use NDC which
    // has no proposals.
    expect(removeCategory(`cat-p-ndc-commons`)).toBe(false);
    expect(categoriesForProject('p-ndc').length).toBe(1);
  });

  it('removeCategory succeeds when an extra category exists and has no refs', () => {
    addCategory({
      id: 'cat-test-disposable',
      projectId: 'p-ndc',
      name: 'Disposable',
      position: 1,
      createdAt: '2026-05-21T00:00:00Z',
    });
    expect(categoriesForProject('p-ndc').length).toBe(2);
    expect(removeCategory('cat-test-disposable')).toBe(true);
    expect(categoriesForProject('p-ndc').length).toBe(1);
  });
});
