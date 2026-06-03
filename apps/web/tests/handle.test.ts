import { describe, expect, it } from 'vitest';

import { handleShapeError, normalizeHandle, suggestHandle } from '../src/lib/handle-shape';

describe('normalizeHandle', () => {
  it('trims and lowercases', () => {
    expect(normalizeHandle('  Marina ')).toBe('marina');
    expect(normalizeHandle('Tomas_42')).toBe('tomas_42');
  });
});

describe('handleShapeError', () => {
  it('accepts valid handles', () => {
    expect(handleShapeError('marina')).toBeNull();
    expect(handleShapeError('tomas_42')).toBeNull();
    expect(handleShapeError('abc')).toBeNull();
  });

  it('enforces length bounds', () => {
    expect(handleShapeError('ab')).toBe('too_short');
    expect(handleShapeError('a'.repeat(21))).toBe('too_long');
  });

  it('requires a leading letter', () => {
    expect(handleShapeError('1abc')).toBe('start_letter');
    expect(handleShapeError('_abc')).toBe('start_letter');
  });

  it('rejects disallowed characters', () => {
    expect(handleShapeError('ab-c')).toBe('charset');
    expect(handleShapeError('ab.c')).toBe('charset');
  });

  it('mirrors the server by normalising first (case-insensitive)', () => {
    expect(handleShapeError('Marina')).toBeNull();
  });
});

describe('suggestHandle', () => {
  it('derives from the email local-part', () => {
    expect(suggestHandle('marina@example.com')).toBe('marina');
  });

  it('strips dots and other disallowed characters', () => {
    expect(suggestHandle('ph.pahl@gmail.com')).toBe('phpahl');
  });

  it('strips leading non-letters', () => {
    expect(suggestHandle('42tomas@example.com')).toBe('tomas');
  });

  it('caps at the max length', () => {
    expect(suggestHandle(`${'a'.repeat(40)}@example.com`).length).toBe(20);
  });

  it('can return a too-short stub the user must extend', () => {
    // local-part with mostly disallowed chars → short result; the form's shape
    // check then nudges the user to lengthen it.
    expect(suggestHandle('a.b@example.com')).toBe('ab');
  });
});
