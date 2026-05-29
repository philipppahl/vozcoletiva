import type { ReactNode } from 'react';

import { useAuth } from '../../lib/auth/hooks';
import { Avatar } from './Avatar';
import { BellButton } from './BellButton';

interface ProjectHeaderProps {
  projectName: string;
  pageTitle: ReactNode;
  /** Optional contextual row below the title (topic chips, alternatives, …). */
  subsection?: ReactNode;
  /** When true, any other project has unread — show a dot on the switcher. */
  otherUnread?: boolean;
  /** When set, a back chevron renders at the far left (detail pages). */
  onBack?: () => void;
  /** Translate the header out of view (driven by scroll). */
  hidden?: boolean;
  onAvatarClick: () => void;
  onProjectClick: () => void;
}

/**
 * The persistent project-scoped header: optional back chevron, avatar
 * (→ preferences), project name + chevron (→ switcher), page title, and an
 * optional contextual subsection. Slides up out of view when `hidden`.
 */
export function ProjectHeader({
  projectName,
  pageTitle,
  subsection,
  otherUnread,
  onBack,
  hidden,
  onAvatarClick,
  onProjectClick,
}: ProjectHeaderProps) {
  const { session } = useAuth();
  return (
    <div
      className="sticky top-0 z-20 border-b"
      style={{
        background: 'color-mix(in oklab, var(--bg) 85%, transparent)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderColor: 'var(--border)',
        transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: 'transform',
      }}
    >
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-1 flex-shrink-0 rounded-full"
            style={{ padding: 4, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path
                d="M13 5l-6 6 6 6"
                stroke="var(--ink)"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onAvatarClick}
          aria-label="Open preferences"
          className="flex-shrink-0 rounded-full"
          style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <Avatar displayName={session?.displayName ?? '?'} size={40} ring="var(--surface)" />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onProjectClick}
            aria-label="Switch project"
            className="relative inline-flex max-w-full items-center gap-1.5"
            style={{
              padding: '2px 8px 2px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span
              className="truncate text-[13px] font-semibold"
              style={{ color: 'var(--ink-soft)', letterSpacing: 0.01 }}
            >
              {projectName}
            </span>
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              style={{ flexShrink: 0, marginTop: 1 }}
              aria-hidden="true"
            >
              <path
                d="M1 1.5L5 4.5L9 1.5"
                stroke="var(--ink-soft)"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {otherUnread && (
              <span
                aria-hidden="true"
                className="inline-block rounded-full"
                style={{ width: 6, height: 6, background: 'var(--accent)' }}
              />
            )}
          </button>
          <div
            className="truncate"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 27,
              lineHeight: 1.08,
              color: 'var(--ink)',
              letterSpacing: -0.4,
              marginTop: 1,
              fontVariationSettings: '"opsz" 32',
            }}
          >
            {pageTitle}
          </div>
        </div>
        <div className="flex-shrink-0 self-start pt-1">
          <BellButton />
        </div>
      </div>
      {subsection && <div className="pb-1">{subsection}</div>}
    </div>
  );
}
