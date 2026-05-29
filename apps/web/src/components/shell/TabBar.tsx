import { Trans } from '@lingui/macro';
import { Link } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { useChannels, useDms } from '../../lib/messages';

export type Tab = 'proposals' | 'documents' | 'messages' | 'search';

interface TabBarProps {
  slug: string;
  current: Tab;
  /** Translate the bar down out of view (driven by scroll). */
  hidden?: boolean;
}

interface TabDef {
  id: Tab;
  label: ReactElement;
  icon: (color: string) => ReactElement;
  to: '/p/$slug' | '/p/$slug/documents' | '/p/$slug/messages' | '/p/$slug/search';
}

const TABS: TabDef[] = [
  {
    id: 'proposals',
    label: <Trans>Proposals</Trans>,
    icon: proposalsIcon,
    to: '/p/$slug',
  },
  {
    id: 'documents',
    label: <Trans>Documents</Trans>,
    icon: documentsIcon,
    to: '/p/$slug/documents',
  },
  {
    id: 'messages',
    label: <Trans>Messages</Trans>,
    icon: messagesIcon,
    to: '/p/$slug/messages',
  },
  {
    id: 'search',
    label: <Trans>Search</Trans>,
    icon: searchIcon,
    to: '/p/$slug/search',
  },
];

/**
 * Sticky bottom tab bar for project-scoped routes. Four equal-width tabs.
 * Active tab uses ink colour; inactive uses muted ink.
 */
export function TabBar({ slug, current, hidden }: TabBarProps) {
  const channels = useChannels(slug);
  const dms = useDms();
  const messagesUnread =
    (channels.data?.channels.reduce((sum, c) => sum + c.unread_count, 0) ?? 0) +
    (dms.data?.dms.reduce((sum, d) => sum + d.unread_count, 0) ?? 0);

  return (
    <nav
      aria-label="Project sections"
      className="sticky bottom-0 z-20 grid grid-cols-4 gap-1 border-t px-3 pb-[max(env(safe-area-inset-bottom),18px)] pt-2"
      style={{
        background: 'color-mix(in oklab, var(--surface) 92%, transparent)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderColor: 'var(--border)',
        transform: hidden ? 'translateY(100%)' : 'translateY(0)',
        transition: 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: 'transform',
      }}
    >
      {TABS.map((tab) => {
        const active = current === tab.id;
        const colour = active ? 'var(--ink)' : 'var(--ink-muted)';
        const badge = tab.id === 'messages' && messagesUnread > 0 ? messagesUnread : 0;
        return (
          <Link
            key={tab.id}
            to={tab.to}
            params={{ slug }}
            className="relative flex flex-col items-center gap-1 rounded-xl px-1 py-2"
            style={{ color: colour }}
          >
            <span className="relative">
              {tab.icon(colour)}
              {badge > 0 && (
                <span
                  role="status"
                  aria-label={`${badge} unread`}
                  className="absolute inline-flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-bold"
                  style={{
                    top: -4,
                    right: -8,
                    background: 'var(--accent)',
                    color: 'var(--accent-ink)',
                    border: '1.5px solid var(--surface)',
                    lineHeight: 1,
                  }}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 10.5,
                fontWeight: active ? 600 : 500,
                letterSpacing: 0.01,
              }}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function proposalsIcon(color: string) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3.5" y="3" width="13" height="14" rx="2" stroke={color} strokeWidth="1.4" />
      <path d="M6.5 7h7M6.5 10h7M6.5 13h4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function documentsIcon(color: string) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5 3h7l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 3v4h4" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7 11h6M7 14h4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function messagesIcon(color: string) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 5a2 2 0 012-2h10a2 2 0 012 2v7a2 2 0 01-2 2H8l-4 3v-3a2 2 0 01-1-2V5z"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function searchIcon(color: string) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5" stroke={color} strokeWidth="1.5" />
      <path d="M13 13l4 4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
