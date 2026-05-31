import { describe, expect, it } from 'vitest';

import { parseMentions } from '../src/components/messages/mentions';

// Mentions encode a Cognito `sub` (a lowercase UUID).
const MARINA = '32b514e4-60c1-70cc-d616-77326d610b5b';
const PEDRO = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('parseMentions', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseMentions('')).toEqual([]);
  });

  it('returns a single text segment when no mentions present', () => {
    expect(parseMentions('hello world')).toEqual([{ kind: 'text', text: 'hello world' }]);
  });

  it('parses a single mention surrounded by text', () => {
    expect(parseMentions(`hi @${MARINA}, thoughts?`)).toEqual([
      { kind: 'text', text: 'hi ' },
      { kind: 'mention', userId: MARINA },
      { kind: 'text', text: ', thoughts?' },
    ]);
  });

  it('parses a mention at the start', () => {
    expect(parseMentions(`@${MARINA} take a look`)).toEqual([
      { kind: 'mention', userId: MARINA },
      { kind: 'text', text: ' take a look' },
    ]);
  });

  it('parses two mentions back to back with a separator', () => {
    expect(parseMentions(`@${MARINA} @${PEDRO}`)).toEqual([
      { kind: 'mention', userId: MARINA },
      { kind: 'text', text: ' ' },
      { kind: 'mention', userId: PEDRO },
    ]);
  });

  it('does not consume a trailing bare @', () => {
    expect(parseMentions('check @')).toEqual([{ kind: 'text', text: 'check @' }]);
  });

  it('leaves an ordinary @word as plain text (only UUID tokens are mentions)', () => {
    expect(parseMentions('@nobody hi')).toEqual([{ kind: 'text', text: '@nobody hi' }]);
  });

  it('does not mistake an email for a mention', () => {
    expect(parseMentions('mail a@b.com please')).toEqual([
      { kind: 'text', text: 'mail a@b.com please' },
    ]);
  });
});
