import { Trans } from '@lingui/macro';
import type { ReactElement } from 'react';

type Status = 'voting' | 'passed' | 'rejected' | 'quorum_failed' | 'withdrawn';

const COLOURS: Record<Status, string> = {
  voting: 'var(--brand)',
  passed: 'var(--color-success)',
  rejected: 'var(--color-danger)',
  quorum_failed: 'var(--color-warning)',
  withdrawn: 'var(--color-neutral-500)',
};

const LABELS: Record<Status, ReactElement> = {
  voting: <Trans>Voting</Trans>,
  passed: <Trans>Passed</Trans>,
  rejected: <Trans>Rejected</Trans>,
  quorum_failed: <Trans>Quorum failed</Trans>,
  withdrawn: <Trans>Withdrawn</Trans>,
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide"
      style={{ background: COLOURS[status], color: '#ffffff' }}
    >
      {LABELS[status]}
    </span>
  );
}
