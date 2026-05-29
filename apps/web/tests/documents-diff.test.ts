import { describe, expect, it } from 'vitest';

import { diffLines } from '../src/components/documents/diff';

describe('diffLines', () => {
  it('returns no rows when both inputs are empty', () => {
    expect(diffLines('', '')).toEqual([]);
  });

  it('identical inputs produce only context rows', () => {
    const out = diffLines('a\nb\nc', 'a\nb\nc');
    expect(out.every((r) => r.kind === 'context')).toBe(true);
    expect(out).toHaveLength(3);
  });

  it('all-add when before is empty', () => {
    const out = diffLines('', 'x\ny');
    expect(out.every((r) => r.kind === 'add')).toBe(true);
    expect(out).toHaveLength(2);
  });

  it('all-remove when after is empty', () => {
    const out = diffLines('x\ny', '');
    expect(out.every((r) => r.kind === 'remove')).toBe(true);
    expect(out).toHaveLength(2);
  });

  it('inserts a new middle line', () => {
    const out = diffLines('a\nc', 'a\nb\nc');
    const kinds = out.map((r) => r.kind);
    expect(kinds).toEqual(['context', 'add', 'context']);
    const [, add] = out;
    expect(add).toEqual({ kind: 'add', afterLine: 2, text: 'b' });
  });

  it('removes a middle line', () => {
    const out = diffLines('a\nb\nc', 'a\nc');
    const kinds = out.map((r) => r.kind);
    expect(kinds).toEqual(['context', 'remove', 'context']);
  });

  it('replace shows up as remove then add', () => {
    const out = diffLines('a\nX\nb', 'a\nY\nb');
    const kinds = out.map((r) => r.kind);
    expect(kinds).toContain('remove');
    expect(kinds).toContain('add');
  });
});
