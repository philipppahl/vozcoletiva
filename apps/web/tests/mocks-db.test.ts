import { beforeEach, describe, expect, it } from 'vitest';

import { deliberationTally, getDb, projectBySlug, userVote } from '../src/mocks/db';
import { seed } from '../src/mocks/seed';

beforeEach(() => {
  seed({ identityKey: 'marina' });
});

describe('mock db seed', () => {
  it('seeds three projects and assigns the current user', () => {
    const db = getDb();
    expect(db.projects.size).toBe(3);
    expect(db.currentUserId).toBe('u-marina');
  });

  it('exposes vila-madalena by slug', () => {
    const p = projectBySlug('vila-madalena');
    expect(p?.name).toBe('Vila Madalena Co-op');
  });

  it('deliberation tally aggregates votes for the bike-racks tree', () => {
    const t = deliberationTally('pr-bike-racks');
    expect(t.total).toBeGreaterThan(0);
    expect(t.total).toBe(t.decisive + t.abstain);
    // bike-racks root + the refurb alternative both appear in the by-choice map
    expect(t.byChoice['pr-bike-racks']).toBeGreaterThan(0);
    expect(t.byChoice['pr-bike-refurb']).toBeGreaterThan(0);
  });

  it('a fresh user has no vote until one is cast', () => {
    const v = userVote('pr-bike-racks', 'u-newcomer');
    expect(v).toBeUndefined();
  });

  it('seed is idempotent — calling twice resets to the same state', () => {
    const before = getDb().projects.size;
    seed({ identityKey: 'marina' });
    expect(getDb().projects.size).toBe(before);
  });
});
