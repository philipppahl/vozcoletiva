import type { ReactNode } from 'react';

interface PlannedPlaceholderProps {
  body: ReactNode;
}

/**
 * Dashed card with a "PLANNED" mono eyebrow, used for tab screens whose
 * functionality lands in a later slice.
 */
export function PlannedPlaceholder({ body }: PlannedPlaceholderProps) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: '1px dashed var(--border)',
      }}
    >
      <span
        className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
        style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent)',
          border: '1px solid var(--accent)',
          letterSpacing: 1.5,
        }}
      >
        Planned
      </span>
      <div
        className="mt-2.5 text-sm"
        style={{
          color: 'var(--ink-soft)',
          lineHeight: 1.55,
          fontFamily: 'var(--font-sans)',
        }}
      >
        {body}
      </div>
    </div>
  );
}
