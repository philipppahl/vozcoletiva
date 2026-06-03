import { describe, expect, it } from 'vitest';

import { parseMentions } from '../src/components/messages/mentions';

// Mentions encode a lowercase @handle (decision 0030).

describe('parseMentions', () => {
  it('returns an empty array for an empty string', () => {
    expect(parseMentions('')).toEqual([]);
  });

  it('returns a single text segment when no mentions present', () => {
    expect(parseMentions('hello world')).toEqual([{ kind: 'text', text: 'hello world' }]);
  });

  it('parses a single mention surrounded by text', () => {
    expect(parseMentions('hi @marina, thoughts?')).toEqual([
      { kind: 'text', text: 'hi ' },
      { kind: 'mention', handle: 'marina' },
      { kind: 'text', text: ', thoughts?' },
    ]);
  });

  it('parses a mention at the start', () => {
    expect(parseMentions('@marina take a look')).toEqual([
      { kind: 'mention', handle: 'marina' },
      { kind: 'text', text: ' take a look' },
    ]);
  });

  it('parses two mentions back to back with a separator', () => {
    expect(parseMentions('@marina @tomas')).toEqual([
      { kind: 'mention', handle: 'marina' },
      { kind: 'text', text: ' ' },
      { kind: 'mention', handle: 'tomas' },
    ]);
  });

  it('lowercases the captured handle to the canonical form', () => {
    expect(parseMentions('@Marina hi')).toEqual([
      { kind: 'mention', handle: 'marina' },
      { kind: 'text', text: ' hi' },
    ]);
  });

  it('does not consume a trailing bare @', () => {
    expect(parseMentions('check @')).toEqual([{ kind: 'text', text: 'check @' }]);
  });

  it('treats a too-short @ab as plain text', () => {
    expect(parseMentions('@ab hi')).toEqual([{ kind: 'text', text: '@ab hi' }]);
  });

  it('does not mistake an email for a mention', () => {
    expect(parseMentions('mail marina@example.com please')).toEqual([
      { kind: 'text', text: 'mail marina@example.com please' },
    ]);
  });
});
