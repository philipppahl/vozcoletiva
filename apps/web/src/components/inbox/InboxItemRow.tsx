import { Trans } from '@lingui/macro';
import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { useMarkInboxItemRead } from '../../lib/inbox';
import type { InboxItem } from '../../lib/inbox/types';

interface InboxItemRowProps {
  item: InboxItem;
}

export function InboxItemRow({ item }: InboxItemRowProps) {
  const navigate = useNavigate();
  const markRead = useMarkInboxItemRead();
  const isUnread = !item.read_at;

  function open() {
    if (isUnread) markRead.mutate(item.id);
    const target = targetFor(item);
    if (target) void navigate(target);
  }

  return (
    <li
      style={{
        borderBottom: '0.5px solid var(--border)',
      }}
    >
      <button
        type="button"
        onClick={open}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <KindIcon kind={item.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <div
              className="min-w-0 flex-1 truncate text-sm"
              style={{ color: 'var(--ink)', fontWeight: isUnread ? 600 : 500 }}
            >
              {titleFor(item)}
            </div>
            <time
              className="flex-shrink-0 text-[11px]"
              style={{ color: 'var(--ink-muted)' }}
              dateTime={item.created_at}
            >
              {relativeTime(item.created_at)}
            </time>
          </div>
          <div
            className="mt-0.5 truncate text-[12.5px]"
            style={{ color: 'var(--ink-soft)', lineHeight: 1.4 }}
          >
            {item.preview}
          </div>
          <div
            className="mt-1 text-[10.5px] font-semibold uppercase"
            style={{ color: 'var(--ink-muted)', letterSpacing: 0.04 }}
          >
            {item.project_name}
          </div>
        </div>
        {isUnread && (
          <span
            aria-hidden="true"
            className="mt-1 inline-block flex-shrink-0 rounded-full"
            style={{ width: 8, height: 8, background: 'var(--accent)' }}
          />
        )}
      </button>
    </li>
  );
}

function titleFor(item: InboxItem): ReactElement | string {
  const actor = item.actor_display_name ?? '';
  switch (item.kind) {
    case 'mention':
      return <Trans>{actor} mentioned you</Trans>;
    case 'reply':
      return <Trans>{actor} replied in a thread</Trans>;
    case 'comment-on-yours':
      return <Trans>{actor} commented on your proposal</Trans>;
    case 'proposal-closed':
      return <Trans>A deliberation you voted in closed</Trans>;
    case 'document-amended':
      return <Trans>{item.document_name ?? ''} has a new version</Trans>;
  }
}

function KindIcon({ kind }: { kind: InboxItem['kind'] }) {
  const colour =
    kind === 'mention'
      ? 'var(--accent)'
      : kind === 'reply'
        ? 'var(--accent)'
        : kind === 'comment-on-yours'
          ? 'var(--ink)'
          : kind === 'proposal-closed'
            ? 'var(--yes)'
            : 'var(--ink)';
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
      style={{
        background: 'var(--surface-2)',
        color: colour,
        border: '0.5px solid var(--border)',
      }}
    >
      <Glyph kind={kind} />
    </span>
  );
}

function Glyph({ kind }: { kind: InboxItem['kind'] }) {
  switch (kind) {
    case 'mention':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.4" />
          <path
            d="M10.6 8.2v.5a1.7 1.7 0 003.4 0V8a6 6 0 10-2.3 4.7"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'reply':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3 4v4a3 3 0 003 3h7M10 8l3 3-3 3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'comment-on-yours':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2.5 3h11v8H6L3 13.5V11h-.5V3z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'proposal-closed':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3 8.5l3 3 7-7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'document-amended':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect
            x="3"
            y="2.5"
            width="10"
            height="11"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M5.5 6.5h5M5.5 9h5M5.5 11.5h3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}

function targetFor(
  item: InboxItem,
): { to: string; params?: Record<string, string>; search?: Record<string, string> } | null {
  if (!item.project_slug) return null;
  switch (item.kind) {
    case 'mention':
    case 'reply':
      if (item.conversation_id?.startsWith('dm-') && item.conversation_id) {
        return { to: '/dms/$id', params: { id: item.conversation_id } };
      }
      if (item.conversation_id) {
        return {
          to: '/p/$slug/messages/$channelId',
          params: { slug: item.project_slug, channelId: item.conversation_id },
        };
      }
      // Fall through to proposal-comment context.
      if (item.proposal_id) {
        return {
          to: '/p/$slug/proposals/$id',
          params: { slug: item.project_slug, id: item.proposal_id },
        };
      }
      return null;
    case 'comment-on-yours':
    case 'proposal-closed':
      if (!item.proposal_id) return null;
      return {
        to: '/p/$slug/proposals/$id',
        params: { slug: item.project_slug, id: item.proposal_id },
      };
    case 'document-amended':
      if (!item.document_name) return null;
      return {
        to: '/p/$slug/documents/$name',
        params: {
          slug: item.project_slug,
          name: encodeURIComponent(item.document_name),
        },
      };
  }
}

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  const now = Date.now();
  const diff = now - then;
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  if (diff < 60 * 1000) return 'just now';
  if (diff < HOUR) return `${Math.round(diff / MIN)}m`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h`;
  if (diff < 7 * DAY) return `${Math.round(diff / DAY)}d`;
  return new Date(then).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
