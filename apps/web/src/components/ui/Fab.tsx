import type { ReactNode } from 'react';

/** Shared styling for the floating action button (proposals "+" / add comment). */
export const fabClassName = 'inline-flex h-14 w-14 items-center justify-center rounded-full';
export const fabStyle = {
  background: 'var(--accent)',
  color: 'var(--accent-ink)',
  boxShadow: 'var(--shadow-lg)',
} as const;

export function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Button variant of the FAB (the proposals one is a Link, styled with the
 *  exported class/style above). */
export function Fab({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={fabClassName}
      style={fabStyle}
    >
      {children ?? <PlusIcon />}
    </button>
  );
}
