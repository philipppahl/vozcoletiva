import { t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Link } from '@tanstack/react-router';

import { useUnreadInboxCount } from '../../lib/inbox';

interface BellButtonProps {
  size?: number;
}

/**
 * Bell entry point to /inbox. Shows a small accent-coloured dot when the
 * caller has unread inbox items. Used in both the home page header and the
 * in-project ProjectHeader.
 */
export function BellButton({ size = 22 }: BellButtonProps) {
  const { _ } = useLingui();
  const unread = useUnreadInboxCount();
  return (
    <Link
      to="/inbox"
      aria-label={_(t`Inbox`)}
      className="relative inline-flex items-center justify-center rounded-full"
      style={{
        width: size + 16,
        height: size + 16,
        color: 'var(--ink)',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path
          d="M5 9a6 6 0 1112 0v3l1.5 2.5a.5.5 0 01-.43.75H3.93a.5.5 0 01-.43-.75L5 12V9z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M9 17.5a2 2 0 004 0"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      {unread > 0 && (
        <span
          role="status"
          aria-label={_(t`${unread} unread`)}
          className="absolute inline-flex items-center justify-center rounded-full px-1"
          style={{
            top: 6,
            right: 6,
            minWidth: 14,
            height: 14,
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            fontSize: 9,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
