import { describe, expect, it } from 'vitest';

import { parseMentions } from '../src/components/messages/mentions';

describe('parseMentions', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseMentions('')).toEqual([]);
  });

  it('returns a single text segment when no mentions present', () => {
    expect(parseMentions('hello world')).toEqual([{ kind: 'text', text: 'hello world' }]);
  });

  it('parses a single mention surrounded by text', () => {
    expect(parseMentions('hi @u-marina, thoughts?')).toEqual([
      { kind: 'text', text: 'hi ' },
      { kind: 'mention', userId: 'u-marina' },
      { kind: 'text', text: ', thoughts?' },
    ]);
  });

  it('parses a mention at the start', () => {
    expect(parseMentions('@u-marina take a look')).toEqual([
      { kind: 'mention', userId: 'u-marina' },
      { kind: 'text', text: ' take a look' },
    ]);
  });

  it('parses two mentions back to back with a separator', () => {
    expect(parseMentions('@u-marina @u-pedro')).toEqual([
      { kind: 'mention', userId: 'u-marina' },
      { kind: 'text', text: ' ' },
      { kind: 'mention', userId: 'u-pedro' },
    ]);
  });

  it('does not consume a trailing bare @', () => {
    expect(parseMentions('check @')).toEqual([{ kind: 'text', text: 'check @' }]);
  });

  it('tokenises unknown ids (render-time decides how to display them)', () => {
    expect(parseMentions('@u-nobody hi')).toEqual([
      { kind: 'mention', userId: 'u-nobody' },
      { kind: 'text', text: ' hi' },
    ]);
  });
});
