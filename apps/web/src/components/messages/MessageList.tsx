import { Trans } from '@lingui/macro';
import { useEffect, useLayoutEffect, useRef } from 'react';

import type { Message } from '../../lib/messages/types';
import { MessageRow } from './MessageRow';
import { UnreadDivider } from './UnreadDivider';

interface MessageListProps {
  messages: Message[];
  /** When set, the first message whose id > this is preceded by an "Unread" divider. */
  lastReadMessageId?: string | null;
  onOpenThread?: (messageId: string) => void;
  projectSlug?: string;
  onRetry?: (message: Message) => void;
}

const DAY_MS = 86_400_000;

/**
 * Bottom-anchored message list. Uses a normal column with a layout effect
 * that snaps to bottom on mount + on new-message-from-self. Doesn't scroll-
 * jerk the user when they're reading history (only follows if they're
 * already near the bottom).
 */
export function MessageList({
  messages,
  lastReadMessageId,
  onOpenThread,
  projectSlug,
  onRetry,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const wasNearBottomRef = useRef(true);

  // Track whether the user is near the bottom *before* the layout updates,
  // so we know whether to follow new messages.
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const onScroll = () => {
      wasNearBottomRef.current = c.scrollHeight - c.scrollTop - c.clientHeight < 80;
    };
    c.addEventListener('scroll', onScroll, { passive: true });
    return () => c.removeEventListener('scroll', onScroll);
  }, []);

  // Snap to bottom on mount; follow new messages only when the user is
  // already at the bottom.
  useLayoutEffect(() => {
    const c = containerRef.current;
    if (!c || messages.length === 0) return;
    const lastId = messages[messages.length - 1]!.id;
    const isFirstRender = lastIdRef.current === null;
    const newArrivals = lastId !== lastIdRef.current;
    if (isFirstRender || (newArrivals && wasNearBottomRef.current)) {
      c.scrollTop = c.scrollHeight;
    }
    lastIdRef.current = lastId;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div ref={containerRef} className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-sm" style={{ color: 'var(--ink-muted)', lineHeight: 1.5 }}>
          <Trans>No messages yet — start the conversation.</Trans>
        </p>
      </div>
    );
  }

  const items = decorate(messages, lastReadMessageId ?? null);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 flex-col overflow-y-auto pb-3"
      style={{ minHeight: 0 }}
    >
      {items.map((it) => {
        if (it.kind === 'day-divider') {
          return <DayDivider key={`day-${it.dayKey}`} iso={it.iso} />;
        }
        if (it.kind === 'unread') {
          return <UnreadDivider key={`unread-${it.beforeId}`} />;
        }
        return (
          <MessageRow
            key={it.message.id}
            message={it.message}
            grouped={it.grouped}
            onOpenThread={onOpenThread}
            projectSlug={projectSlug}
            onRetry={onRetry}
          />
        );
      })}
    </div>
  );
}

type Item =
  | { kind: 'day-divider'; dayKey: string; iso: string }
  | { kind: 'unread'; beforeId: string }
  | { kind: 'msg'; message: Message; grouped: boolean };

function decorate(messages: Message[], lastReadId: string | null): Item[] {
  const out: Item[] = [];
  let lastDay: string | null = null;
  let lastAuthor: string | null = null;
  let lastAtMs = 0;
  let unreadInserted = false;
  const readIdx = lastReadId ? messages.findIndex((m) => m.id === lastReadId) : -1;
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i]!;
    const dayKey = m.created_at.slice(0, 10);
    if (dayKey !== lastDay) {
      out.push({ kind: 'day-divider', dayKey, iso: m.created_at });
      lastDay = dayKey;
      lastAuthor = null; // first row of a day always shows the avatar
    }
    if (lastReadId && !unreadInserted && readIdx >= 0 && i === readIdx + 1) {
      out.push({ kind: 'unread', beforeId: m.id });
      unreadInserted = true;
      lastAuthor = null;
    }
    const atMs = Date.parse(m.created_at);
    const grouped =
      lastAuthor === m.author_id && atMs - lastAtMs < 5 * 60_000 && !m.parent_message_id;
    out.push({ kind: 'msg', message: m, grouped });
    lastAuthor = m.author_id;
    lastAtMs = atMs;
  }
  return out;
}

function DayDivider({ iso }: { iso: string }) {
  const d = new Date(iso);
  const now = new Date();
  const today = now.toDateString() === d.toDateString();
  const yesterday = now.toDateString() === new Date(d.getTime() + DAY_MS).toDateString();
  const label = today ? (
    <Trans>Today</Trans>
  ) : yesterday ? (
    <Trans>Yesterday</Trans>
  ) : (
    d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  );
  return (
    <div
      className="my-2 flex items-center gap-2 px-4 text-[10.5px] font-semibold uppercase"
      style={{ color: 'var(--ink-muted)', letterSpacing: 0.08 }}
    >
      <span
        aria-hidden="true"
        className="flex-1"
        style={{ height: 1, background: 'var(--border)' }}
      />
      <span style={{ flexShrink: 0 }}>{label}</span>
      <span
        aria-hidden="true"
        className="flex-1"
        style={{ height: 1, background: 'var(--border)' }}
      />
    </div>
  );
}
