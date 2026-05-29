import { afterEach, describe, expect, it, vi } from 'vitest';

import { emit, subscribe, subscriberCount } from '../src/mocks/messageBus';

afterEach(() => {
  // Bus is module-singleton; explicit teardown via the unsubscribe returned
  // by each subscribe(). Track them in the test.
});

describe('messageBus', () => {
  it('delivers events to a subscriber', () => {
    const handler = vi.fn();
    const unsub = subscribe(handler);
    emit({
      type: 'conversation.message-created',
      message: makeMessage('m-1'),
    });
    expect(handler).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('delivers to multiple subscribers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    const u1 = subscribe(h1);
    const u2 = subscribe(h2);
    emit({ type: 'conversation.message-created', message: makeMessage('m-2') });
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
    u1();
    u2();
  });

  it('stops delivering after unsubscribe', () => {
    const handler = vi.fn();
    const unsub = subscribe(handler);
    unsub();
    emit({ type: 'conversation.message-created', message: makeMessage('m-3') });
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects double-subscribe (same function reference)', () => {
    const handler = vi.fn();
    const u1 = subscribe(handler);
    const u2 = subscribe(handler);
    emit({ type: 'conversation.message-created', message: makeMessage('m-4') });
    expect(handler).toHaveBeenCalledTimes(1);
    u1();
    u2();
  });

  it('tracks subscriber count', () => {
    const before = subscriberCount();
    const u = subscribe(() => {});
    expect(subscriberCount()).toBe(before + 1);
    u();
    expect(subscriberCount()).toBe(before);
  });
});

function makeMessage(id: string) {
  return {
    id,
    conversationId: 'c-1',
    parentMessageId: null,
    authorId: 'u-1',
    body: 'hello',
    attachments: [],
    createdAt: '2026-05-20T10:00:00Z',
    editedAt: null,
  };
}
