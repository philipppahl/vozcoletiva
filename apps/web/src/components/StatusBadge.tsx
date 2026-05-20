import { Trans } from '@lingui/macro';
import type { ReactElement } from 'react';

type Status = 'voting' | 'passed' | 'rejected' | 'quorum_failed' | 'withdrawn';

interface ToneSpec {
  bg: string;
  fg: string;
  border: string;
  dot?: string;
}

const TONES: Record<Status, ToneSpec> = {
  voting: {
    bg: 'var(--accent-soft)',
    fg: 'var(--accent)',
    border: 'transparent',
    dot: 'var(--accent)',
  },
  passed: {
    bg: 'transparent',
    fg: 'var(--yes)',
    border: 'var(--yes)',
  },
  rejected: {
    bg: 'transparent',
    fg: 'var(--no)',
    border: 'var(--no)',
  },
  quorum_failed: {
    bg: 'transparent',
    fg: 'var(--warn)',
    border: 'var(--warn)',
  },
  withdrawn: {
    bg: 'var(--surface-2)',
    fg: 'var(--ink-muted)',
    border: 'transparent',
  },
};

const LABELS: Record<Status, ReactElement> = {
  voting: <Trans>Voting</Trans>,
  passed: <Trans>Passed</Trans>,
  rejected: <Trans>Rejected</Trans>,
  quorum_failed: <Trans>Quorum failed</Trans>,
  withdrawn: <Trans>Withdrawn</Trans>,
};

export function StatusBadge({ status }: { status: Status }) {
  const tone = TONES[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        background: tone.bg,
        color: tone.fg,
        border: tone.border === 'transparent' ? 'none' : `1px solid ${tone.border}`,
      }}
    >
      {tone.dot && (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: tone.dot,
          }}
        />
      )}
      {LABELS[status]}
    </span>
  );
}
