import { Trans } from '@lingui/macro';
import { Link } from '@tanstack/react-router';

import { useAuth } from '../../lib/auth/hooks';
import type { DmConversation } from '../../lib/messages/types';
import { RelativeTime } from '../RelativeTime';
import { Avatar } from '../shell/Avatar';

interface DmListSectionProps {
  dms: DmConversation[];
  onStartDm: () => void;
}

export function DmListSection({ dms, onStartDm }: DmListSectionProps) {
  const { session } = useAuth();
  const meId = session?.userId;
  const ordered = [...dms].sort((a, b) => {
    const aAt = a.last_message?.at ?? '';
    const bAt = b.last_message?.at ?? '';
    return bAt.localeCompare(aAt);
  });
  return (
    <section className="px-4 pt-6">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3
          className="text-[11px] font-semibold uppercase"
          style={{ color: 'var(--ink-soft)', letterSpacing: 0.06 }}
        >
          <Trans>Direct messages</Trans>
        </h3>
        <button
          type="button"
          onClick={onStartDm}
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
            <Trans>No direct messages yet.</Trans>
          </li>
        ) : (
          ordered.map((d, i) => {
            const peer = d.participants.find((p) => p.user_id !== meId) ?? d.participants[0]!;
            return (
              <li
                key={d.id}
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <Link
                  to="/dms/$id"
                  params={{ id: d.id }}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ color: 'var(--ink)' }}
                >
                  <Avatar displayName={peer.display_name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className="truncate text-sm font-semibold"
                        style={{ color: 'var(--ink)' }}
                      >
                        {peer.display_name}
                      </span>
                      {d.last_message && (
                        <span
                          className="flex-shrink-0 text-[11px]"
                          style={{ color: 'var(--ink-muted)' }}
                        >
                          <RelativeTime iso={d.last_message.at} />
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-0.5 truncate text-[12.5px]"
                      style={{ color: 'var(--ink-soft)', lineHeight: 1.35 }}
                    >
                      {d.last_message ? (
                        d.last_message.body_preview
                      ) : (
                        <span style={{ color: 'var(--ink-muted)' }}>
                          <Trans>No messages yet</Trans>
                        </span>
                      )}
                    </div>
                  </div>
                  {d.unread_count > 0 && (
                    <span
                      className="inline-flex h-[22px] min-w-[22px] flex-shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                      style={{
                        background: 'var(--accent)',
                        color: 'var(--accent-ink)',
                      }}
                    >
                      {d.unread_count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
