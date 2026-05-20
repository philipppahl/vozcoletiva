import { Trans } from '@lingui/macro';
import type { ReactElement } from 'react';

interface RoleBadgeProps {
  role: 'owner' | 'admin' | 'moderator' | 'member' | 'observer';
}

const LABELS: Record<RoleBadgeProps['role'], ReactElement> = {
  owner: <Trans>Owner</Trans>,
  admin: <Trans>Admin</Trans>,
  moderator: <Trans>Moderator</Trans>,
  member: <Trans>Member</Trans>,
  observer: <Trans>Observer</Trans>,
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const accent = role === 'owner' || role === 'admin';
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        background: accent ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: accent ? 'var(--accent)' : 'var(--ink-soft)',
      }}
    >
      {LABELS[role]}
    </span>
  );
}
