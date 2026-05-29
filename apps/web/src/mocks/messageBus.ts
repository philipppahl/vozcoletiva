/**
 * In-process pub/sub that stands in for the eventual WebSocket. The mock
 * handlers `emit` after every write; FE hooks `subscribe` and merge new
 * messages into TanStack Query caches without a refetch.
 *
 * Why a Set rather than an array: avoids double-subscribe under Vite HMR or
 * StrictMode (handlers are referentially compared).
 */

import { mockNowIso } from './clock';
import { getDb, type MockAttachment, type MockMessage } from './db';

export type BusEvent =
  | { type: 'conversation.message-created'; message: MockMessage }
  | { type: 'conversation.message-edited'; message: MockMessage }
  | {
      type: 'conversation.read';
      conversationId: string;
      userId: string;
      lastReadMessageId: string;
    };

type Handler = (event: BusEvent) => void;

const handlers = new Set<Handler>();

export function subscribe(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function emit(event: BusEvent) {
  for (const handler of handlers) {
    try {
      handler(event);
    } catch (err) {
      // Never let one bad subscriber break the others.
      console.error('[mock] bus handler threw', err);
    }
  }
}

export function subscriberCount(): number {
  return handlers.size;
}

// ── auto-emit (the "Busy channels" scenario) ────────────────────────────────

let autoEmitTimer: ReturnType<typeof setInterval> | null = null;

interface AutoEmitConfig {
  intervalMs: number;
  // Picks from the seeded users (excluding the current viewer) and from the
  // seeded channels to make the channels look alive.
}

const STARTER_LINES = [
  'Quick update from my side.',
  'Just dropping a note — saw the latest figures.',
  'Anyone got a minute later?',
  'Photo from the walk-through:',
  'Will follow up tomorrow.',
  '+1 to that.',
  'Pinged the supplier; no reply yet.',
  'Reading now.',
  'Side thought — should we get a third opinion?',
  '👍',
];

export function startAutoEmit(config: AutoEmitConfig = { intervalMs: 30_000 }) {
  stopAutoEmit();
  autoEmitTimer = setInterval(() => {
    const db = getDb();
    const channels = Array.from(db.conversations.values()).filter((c) => c.kind === 'channel');
    if (channels.length === 0) return;
    const channel = channels[Math.floor(Math.random() * channels.length)]!;
    const userIds = Array.from(db.users.keys()).filter(
      (id) => id !== db.currentUserId && id !== 'u-newcomer',
    );
    if (userIds.length === 0) return;
    const author = userIds[Math.floor(Math.random() * userIds.length)]!;
    const body = STARTER_LINES[Math.floor(Math.random() * STARTER_LINES.length)]!;
    const id = `m-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const message: MockMessage = {
      id,
      conversationId: channel.id,
      parentMessageId: null,
      authorId: author,
      body,
      attachments: [] as MockAttachment[],
      createdAt: mockNowIso(),
      editedAt: null,
    };
    db.messages.set(id, message);
    emit({ type: 'conversation.message-created', message });
  }, config.intervalMs);
}

export function stopAutoEmit() {
  if (autoEmitTimer) {
    clearInterval(autoEmitTimer);
    autoEmitTimer = null;
  }
}

export function isAutoEmitOn(): boolean {
  return autoEmitTimer !== null;
}
