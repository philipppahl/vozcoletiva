import type { ReactNode } from 'react';

import { useAuth } from '../../lib/auth/hooks';
import { Avatar } from './Avatar';

interface ProjectHeaderProps {
  projectName: string;
  pageTitle: ReactNode;
  onAvatarClick: () => void;
  onProjectClick: () => void;
}

/**
 * The persistent project-scoped header: avatar (tap → preferences),
 * project name + chevron (tap → top sheet), page title below.
 * Sticky and glassy.
 */
export function ProjectHeader({
  projectName,
  pageTitle,
  onAvatarClick,
  onProjectClick,
}: ProjectHeaderProps) {
  const { session } = useAuth();
  return (
    <div
      className="sticky top-0 z-10 flex min-h-[76px] items-center gap-3 border-b px-4"
      style={{
        background: 'color-mix(in oklab, var(--bg) 85%, transparent)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderColor: 'var(--border)',
        paddingTop: 14,
        paddingBottom: 14,
      }}
    >
      <button
        type="button"
        onClick={onAvatarClick}
        aria-label="Open preferences"
        className="flex-shrink-0 rounded-full"
        style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
      >
        <Avatar displayName={session?.displayName ?? '?'} size={38} ring="var(--surface)" />
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onProjectClick}
          aria-label="Switch project"
          className="inline-flex max-w-full items-center gap-1"
          style={{
            padding: 0,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span
            className="truncate text-[11px] font-semibold uppercase"
            style={{ color: 'var(--ink-soft)', letterSpacing: 0.05 }}
          >
            {projectName}
          </span>
          <svg
            width="9"
            height="6"
            viewBox="0 0 9 6"
            fill="none"
            style={{ flexShrink: 0, marginTop: 1 }}
            aria-hidden="true"
          >
            <path
              d="M1 1.5L4.5 4.5L8 1.5"
              stroke="var(--ink-muted)"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div
          className="truncate"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 26,
            lineHeight: 1.05,
            color: 'var(--ink)',
            letterSpacing: -0.4,
            marginTop: 2,
            fontVariationSettings: '"opsz" 32',
          }}
        >
          {pageTitle}
        </div>
      </div>
      <div style={{ width: 38, flexShrink: 0 }} aria-hidden="true" />
    </div>
  );
}
