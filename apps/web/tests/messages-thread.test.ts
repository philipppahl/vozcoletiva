import { beforeEach, describe, expect, it } from 'vitest';

import {
  conversationUnreadCount,
  getDb,
  setConversationRead,
  setThreadRead,
  threadUnreadCount,
} from '../src/mocks/db';
import { seed } from '../src/mocks/seed';

beforeEach(() => seed({ identityKey: 'marina' }));

describe('thread unread math', () => {
  it('counts replies created after the per-thread read marker', () => {
    // The seeded thread is rooted on m-b-1 with replies m-b-2, m-b-3, m-b-4.
    // Marina has never opened the thread, so the conversation-level read
    // marker controls — m-b-5 (the next top-level) is her last-read for
    // #bicicletas (per seed). Replies created before that marker count as
    // read; those after count as unread.
    const beforeOpen = threadUnreadCount('m-b-1', 'u-marina');
    expect(beforeOpen).toBe(0); // all replies pre-date m-b-5

    // Seed timestamps are non-monotonic in id order — chronological order is
    // m-b-3 (earliest) → m-b-2 → m-b-4 (latest). Reading up to m-b-2 leaves
    // only m-b-4 unread.
    setThreadRead('m-b-1', 'u-marina', 'm-b-2', '2026-05-20T00:00:00Z');
    expect(threadUnreadCount('m-b-1', 'u-marina')).toBe(1);
  });

  it('returns 0 for a parent with no replies', () => {
    // m-g-1 in #general has no replies.
    expect(threadUnreadCount('m-g-1', 'u-marina')).toBe(0);
  });
});

describe('conversation unread', () => {
  it('counts only top-level messages after the last-read', () => {
    // Per seed, Marina last-read in #general is m-g-6; m-g-7/8/9 are top-level.
    expect(conversationUnreadCount('ch-vmc-general', 'u-marina')).toBe(3);
  });

  it('updates when the marker advances', () => {
    setConversationRead(
      'ch-vmc-general',
      'u-marina',
      // m-g-9 is the latest top-level message in #general.
      'm-g-9',
      '2026-05-20T00:00:00Z',
    );
    expect(conversationUnreadCount('ch-vmc-general', 'u-marina')).toBe(0);
  });

  it('treats DM with no marker yet as fully unread for that user', () => {
    // Pedro hasn't been seeded with a read marker for his DM with Marina.
    const db = getDb();
    db.currentUserId = 'u-pedro';
    expect(conversationUnreadCount('dm-marina-pedro', 'u-pedro')).toBe(4);
  });
});
