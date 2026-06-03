import { describe, expect, it } from 'vitest';

import { applyReactionToggle, type Reaction } from '../src/lib/messages/types';

describe('applyReactionToggle', () => {
  it('adds a brand-new reaction with me=true', () => {
    expect(applyReactionToggle([], '👍', true)).toEqual([{ emoji: '👍', count: 1, me: true }]);
  });

  it('joins an existing reaction (count up, me=true)', () => {
    const start: Reaction[] = [{ emoji: '👍', count: 2, me: false }];
    expect(applyReactionToggle(start, '👍', true)).toEqual([{ emoji: '👍', count: 3, me: true }]);
  });

  it('is a no-op when already reacted', () => {
    const start: Reaction[] = [{ emoji: '👍', count: 1, me: true }];
    expect(applyReactionToggle(start, '👍', true)).toBe(start);
  });

  it('removes my reaction (count down, me=false)', () => {
    const start: Reaction[] = [{ emoji: '👍', count: 2, me: true }];
    expect(applyReactionToggle(start, '👍', false)).toEqual([{ emoji: '👍', count: 1, me: false }]);
  });

  it('drops the pill when the last reactor leaves', () => {
    const start: Reaction[] = [{ emoji: '👍', count: 1, me: true }];
    expect(applyReactionToggle(start, '👍', false)).toEqual([]);
  });

  it('is a no-op removing one you never added', () => {
    const start: Reaction[] = [{ emoji: '👍', count: 3, me: false }];
    expect(applyReactionToggle(start, '👍', false)).toBe(start);
  });

  it('leaves other emojis untouched', () => {
    const start: Reaction[] = [{ emoji: '👍', count: 1, me: false }];
    expect(applyReactionToggle(start, '❤️', true)).toEqual([
      { emoji: '👍', count: 1, me: false },
      { emoji: '❤️', count: 1, me: true },
    ]);
  });
});
