import { Trans } from '@lingui/macro';
import { Link } from '@tanstack/react-router';

import type { ChannelConversation } from '../../lib/messages/types';
import { RelativeTime } from '../RelativeTime';

interface ChannelListSectionProps {
  slug: string;
  channels: ChannelConversation[];
  /** Toasted by parent when the user taps "New channel" (Planned in M2). */
  onNewChannel: () => void;
}

export function ChannelListSection({ slug, channels, onNewChannel }: ChannelListSectionProps) {
  const ordered = [...channels].sort((a, b) => {
    const aAt = a.last_message?.at ?? '';
    const bAt = b.last_message?.at ?? '';
    return bAt.localeCompare(aAt);
  });
  return (
    <section className="px-4 pt-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3
          className="text-[11px] font-semibold uppercase"
          style={{ color: 'var(--ink-soft)', letterSpacing: 0.06 }}
        >
          <Trans>Channels</Trans>
        </h3>
        <button
          type="button"
          onClick={onNewChannel}
          className="text-[12px] font-semibold"
          style={{
            color: 'var(--accent)',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <Trans>+ New</Trans>
        </button>
      </div>
      <ul
        className="overflow-hidden rounded-2xl"
        style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {ordered.length === 0 ? (
          <li className="px-4 py-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
            <Trans>No channels yet.</Trans>
          </li>
        ) : (
          ordered.map((c, i) => (
            <li
              key={c.id}
              style={{
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <Link
                to="/p/$slug/messages/$channelId"
                params={{ slug, channelId: c.id }}
                className="flex items-center gap-3 px-4 py-3"
                style={{ color: 'var(--ink)' }}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: 'var(--surface-2)',
                    border: '0.5px solid var(--border)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 16,
                    color: 'var(--ink-soft)',
                  }}
                >
                  #
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--ink)' }}
                    >
                      {c.name}
                    </span>
                    {c.last_message && (
                      <span
                        className="flex-shrink-0 text-[11px]"
                        style={{ color: 'var(--ink-muted)' }}
                      >
                        <RelativeTime iso={c.last_message.at} />
                      </span>
                    )}
                  </div>
                  <div
                    className="mt-0.5 truncate text-[12.5px]"
                    style={{ color: 'var(--ink-soft)', lineHeight: 1.35 }}
                  >
                    {c.last_message ? (
                      <>
                        <span style={{ color: 'var(--ink-muted)' }}>
                          {c.last_message.author_display_name}:
                        </span>{' '}
                        {c.last_message.body_preview}
                      </>
                    ) : (
                      <span style={{ color: 'var(--ink-muted)' }}>
                        <Trans>No messages yet</Trans>
                      </span>
                    )}
                  </div>
                </div>
                {c.unread_count > 0 && (
                  <span
                    className="inline-flex h-[22px] min-w-[22px] flex-shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--accent-ink)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {c.unread_count}
                  </span>
                )}
              </Link>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
