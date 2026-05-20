import type { ReactNode } from 'react';

interface TopBarProps {
  /** Page title rendered as the main label. */
  title: ReactNode;
  /** Optional eyebrow (e.g. project name) above the title. */
  eyebrow?: ReactNode;
  /** Back chevron handler. If omitted, no chevron renders. */
  onBack?: () => void;
  /** Optional right-side slot (icon button, kebab, etc.). */
  rightSlot?: ReactNode;
}

/**
 * Sub-page header with back chevron + glassy chrome. Used for routes that
 * sit one level deeper than the project home (proposal detail, members,
 * invites, preferences, compose, etc.).
 */
export function TopBar({ title, eyebrow, onBack, rightSlot }: TopBarProps) {
  return (
    <div
      className="sticky top-0 z-10 flex min-h-[62px] items-center gap-2 border-b px-4"
      style={{
        background: 'color-mix(in oklab, var(--bg) 85%, transparent)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderColor: 'var(--border)',
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="-ml-2 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ color: 'var(--ink)' }}
        >
          <ChevronLeft />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div
            className="truncate text-[11px] font-semibold uppercase leading-none"
            style={{ color: 'var(--ink-muted)', letterSpacing: 0.05 }}
          >
            {eyebrow}
          </div>
        )}
        <div
          className="truncate text-base font-semibold"
          style={{
            color: 'var(--ink)',
            marginTop: eyebrow ? 2 : 0,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
      </div>
      {rightSlot ? <div className="flex-shrink-0">{rightSlot}</div> : null}
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M12 4l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
