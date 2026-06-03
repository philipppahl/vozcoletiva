import { describe, expect, it } from 'vitest';

import { tokeniseInline } from '../src/lib/messages/inline';

describe('tokeniseInline — bare URL linkify', () => {
  it('linkifies a bare URL', () => {
    expect(tokeniseInline('see https://vozcoletiva.com now')).toEqual([
      { kind: 'text', text: 'see ' },
      { kind: 'link', text: 'https://vozcoletiva.com', url: 'https://vozcoletiva.com' },
      { kind: 'text', text: ' now' },
    ]);
  });

  it('keeps trailing punctuation out of the URL', () => {
    expect(tokeniseInline('(see https://x.com/a).')).toEqual([
      { kind: 'text', text: '(see ' },
      { kind: 'link', text: 'https://x.com/a', url: 'https://x.com/a' },
      { kind: 'text', text: ').' },
    ]);
  });

  it('does not double-linkify a markdown link', () => {
    expect(tokeniseInline('[docs](https://x.com/y)')).toEqual([
      { kind: 'link', text: 'docs', url: 'https://x.com/y' },
    ]);
  });

  it('leaves an email alone (no scheme)', () => {
    expect(tokeniseInline('mail marina@example.com')).toEqual([
      { kind: 'text', text: 'mail marina@example.com' },
    ]);
  });

  it('still handles bold + code', () => {
    expect(tokeniseInline('**hi** `x`')).toEqual([
      { kind: 'bold', text: 'hi' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'x' },
    ]);
  });
});
