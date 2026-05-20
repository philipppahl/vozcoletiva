import { Trans } from '@lingui/macro';
import { Link } from '@tanstack/react-router';
import type { ReactElement } from 'react';

export type Tab = 'proposals' | 'documents' | 'messages' | 'search';

interface TabBarProps {
  slug: string;
  current: Tab;
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
export function TabBar({ slug, current }: TabBarProps) {
  return (
    <nav
      aria-label="Project sections"
      className="sticky bottom-0 z-10 grid grid-cols-4 gap-1 border-t px-3 pb-[max(env(safe-area-inset-bottom),18px)] pt-2"
      style={{
        background: 'color-mix(in oklab, var(--surface) 92%, transparent)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderColor: 'var(--border)',
      }}
    >
      {TABS.map((tab) => {
        const active = current === tab.id;
        const colour = active ? 'var(--ink)' : 'var(--ink-muted)';
        return (
          <Link
            key={tab.id}
            to={tab.to}
            params={{ slug }}
            className="flex flex-col items-center gap-1 rounded-xl px-1 py-2"
            style={{ color: colour }}
          >
            {tab.icon(colour)}
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
