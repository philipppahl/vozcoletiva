import { describe, expect, it } from 'vitest';

import { type Message, toReplyTo } from '../src/lib/messages/types';

function msg(over: Partial<Message>): Message {
  return {
    id: 'm1',
    conversation_id: 'c1',
    author_id: 'u1',
    author_display_name: 'Tomás',
    body: '',
    attachments: [],
    created_at: '2026-06-03T00:00:00Z',
    reply_count: 0,
    reactions: [],
    ...over,
  };
}

describe('toReplyTo', () => {
  it('snapshots text with a truncated preview', () => {
    const r = toReplyTo(msg({ body: 'Proposta do bicicletário?' }));
    expect(r).toEqual({
      id: 'm1',
      author_display_name: 'Tomás',
      preview: 'Proposta do bicicletário?',
      kind: 'text',
    });
  });

  it('caps the preview at 80 chars', () => {
    const long = 'x'.repeat(200);
    expect(toReplyTo(msg({ body: long })).preview).toHaveLength(80);
  });

  it('uses the media kind when there is no text', () => {
    const r = toReplyTo(msg({ body: '', attachments: [{ kind: 'image', url: 'u' }] }));
    expect(r.kind).toBe('image');
    expect(r.preview).toBe('');
  });

  it('prefers text over an attachment when both are present', () => {
    const r = toReplyTo(msg({ body: 'look', attachments: [{ kind: 'image', url: 'u' }] }));
    expect(r.kind).toBe('text');
    expect(r.preview).toBe('look');
  });
});
