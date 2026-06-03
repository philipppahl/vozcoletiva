import { Trans } from '@lingui/macro';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { Message } from '../../lib/messages/types';
import { MessageActions } from './MessageActions';
import { MessageRow } from './MessageRow';
import { UnreadDivider } from './UnreadDivider';

interface MessageListProps {
  messages: Message[];
  /** When set, the first message whose id > this is preceded by an "Unread" divider. */
  lastReadMessageId?: string | null;
  onOpenThread?: (messageId: string) => void;
  projectSlug?: string;
  onRetry?: (message: Message) => void;
  /** Resolve an author's avatar URL (channel members / DM participants). */
  avatarFor?: (userId: string) => string | null | undefined;
  /** Quote-reply to a message (swipe-right or the long-press menu). */
  onReply?: (message: Message) => void;
  /** Toggle a reaction on a message (decision 0031). */
  onToggleReaction?: (messageId: string, emoji: string, active: boolean) => void;
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
  avatarFor,
  onReply,
  onToggleReaction,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const wasNearBottomRef = useRef(true);
  const [actionTarget, setActionTarget] = useState<Message | null>(null);
  // The message currently in free text-selection mode (decision 0031).
  const [selectableId, setSelectableId] = useState<string | null>(null);

  // Pre-select the message's text on entering select mode, so the OS handles
  // appear and the user can refine + copy.
  useEffect(() => {
    if (!selectableId) return undefined;
    const raf = requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector<HTMLElement>(
        `[data-mid="${CSS.escape(selectableId)}"] [data-msgtext]`,
      );
      if (!el) return;
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
    return () => cancelAnimationFrame(raf);
  }, [selectableId]);

  // A tap outside the selected message exits select mode (back to long-press).
  useEffect(() => {
    if (!selectableId) return undefined;
    const onDown = (e: PointerEvent) => {
      const el = containerRef.current?.querySelector(`[data-mid="${CSS.escape(selectableId)}"]`);
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setSelectableId(null);
        window.getSelection()?.removeAllRanges();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [selectableId]);

  // Scroll to + briefly flash a message (tapping a quote header jumps here).
  const jumpTo = (id: string) => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-mid="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.animate?.(
      [
        { boxShadow: '0 0 0 3px var(--accent)' },
        { boxShadow: '0 0 0 3px var(--accent)', offset: 0.6 },
        { boxShadow: '0 0 0 0 transparent' },
      ],
      { duration: 1300, easing: 'ease-out' },
    );
  };

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
            tail={it.tail}
            onOpenThread={onOpenThread}
            projectSlug={projectSlug}
            onRetry={onRetry}
            avatarUrl={avatarFor?.(it.message.author_id)}
            onReply={onReply}
            onLongPress={(m) => {
              setSelectableId(null);
              setActionTarget(m);
            }}
            onJumpTo={jumpTo}
            onToggleReaction={onToggleReaction}
            selectable={it.message.id === selectableId}
          />
        );
      })}
      <MessageActions
        message={actionTarget}
        onClose={() => setActionTarget(null)}
        onReply={(m) => onReply?.(m)}
        onOpenThread={onOpenThread}
        onToggleReaction={onToggleReaction}
        onSelectText={(m) => setSelectableId(m.id)}
      />
    </div>
  );
}

type MsgItem = { kind: 'msg'; message: Message; grouped: boolean; tail: boolean };
type Item =
  | { kind: 'day-divider'; dayKey: string; iso: string }
  | { kind: 'unread'; beforeId: string }
  | MsgItem;

function decorate(messages: Message[], lastReadId: string | null): Item[] {
  const out: Item[] = [];
  let lastDay: string | null = null;
  let lastAuthor: string | null = null;
  let lastAtMs = 0;
  let unreadInserted = false;
  // The most recent msg item — cleared to false (no tail) when the next msg
  // groups onto it. The last of any same-author run keeps tail = true.
  let lastMsgItem: MsgItem | null = null;
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
    // A reply starts a fresh bubble (it carries a quote header), never grouping.
    const grouped = lastAuthor === m.author_id && atMs - lastAtMs < 5 * 60_000 && !m.reply_to;
    const item: MsgItem = { kind: 'msg', message: m, grouped, tail: true };
    if (grouped && lastMsgItem) lastMsgItem.tail = false;
    out.push(item);
    lastMsgItem = item;
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
