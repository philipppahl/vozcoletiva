import { beforeEach, describe, expect, it } from 'vitest';

import { runSearch } from '../src/mocks/handlers/search';
import { seed } from '../src/mocks/seed';

beforeEach(() => {
  seed({ identityKey: 'marina' });
});

describe('runSearch', () => {
  it('empty query returns empty sections', () => {
    const r = runSearch('p-vmc', '');
    expect(r.sections.proposals.hits).toEqual([]);
    expect(r.sections.documents.hits).toEqual([]);
    expect(r.sections.members.hits).toEqual([]);
    expect(r.sections.channels.hits).toEqual([]);
  });

  it('single-char query returns empty sections', () => {
    const r = runSearch('p-vmc', 'a');
    expect(r.sections.proposals.hits).toEqual([]);
  });

  it('"noise" finds the noise-policy proposal', () => {
    const r = runSearch('p-vmc', 'noise');
    const ids = r.sections.proposals.hits.map((h) => h.id);
    expect(ids).toContain('pr-noise-policy');
  });

  it('case-insensitive: "NOISE" matches the same items as "noise"', () => {
    const upper = runSearch('p-vmc', 'NOISE').sections.proposals.hits.map((h) => h.id);
    const lower = runSearch('p-vmc', 'noise').sections.proposals.hits.map((h) => h.id);
    expect(upper).toEqual(lower);
  });

  it('"house rules" finds the House Rules document', () => {
    const r = runSearch('p-vmc', 'house rules');
    const names = r.sections.documents.hits.map((h) => h.name);
    expect(names).toContain('House Rules');
  });

  it('"marina" finds Marina in the members section', () => {
    const r = runSearch('p-vmc', 'marina');
    const names = r.sections.members.hits.map((h) => h.display_name);
    expect(names).toContain('Marina Costa');
  });

  it('"general" finds the #general channel', () => {
    const r = runSearch('p-vmc', 'general');
    const ids = r.sections.channels.hits.map((h) => h.id);
    expect(ids).toContain('ch-vmc-general');
  });

  it('snippet is a window centred on the match, not the start of the body', () => {
    const r = runSearch('p-vmc', 'corroded');
    const hit = r.sections.proposals.hits.find((h) => h.id === 'pr-bike-racks');
    expect(hit?.snippet).toMatch(/corroded/i);
    // Snippet wraps the match with an ellipsis prefix since "corroded" is not
    // at the very start of the bike-racks body.
    expect(hit?.snippet.startsWith('…')).toBe(true);
  });

  it('returns empty all-sections for a query with no hits', () => {
    const r = runSearch('p-vmc', 'zzzznotinanyseededdata');
    expect(r.sections.proposals.hits).toEqual([]);
    expect(r.sections.documents.hits).toEqual([]);
    expect(r.sections.members.hits).toEqual([]);
    expect(r.sections.channels.hits).toEqual([]);
  });
});
