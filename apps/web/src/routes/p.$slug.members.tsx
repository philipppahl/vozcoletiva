import { Trans } from '@lingui/macro';
import { createFileRoute } from '@tanstack/react-router';

import { RoleBadge } from '../components/RoleBadge';
import { useMembers } from '../lib/projects';

export const Route = createFileRoute('/p/$slug/members')({
  component: MembersPage,
});

function MembersPage() {
  const { slug } = Route.useParams();
  const members = useMembers(slug);

  if (members.isLoading) {
    return (
      <p style={{ color: 'var(--text-muted)' }}>
        <Trans>Loading…</Trans>
      </p>
    );
  }
  if (members.error || !members.data) {
    return (
      <p style={{ color: 'var(--color-danger)' }}>
        <Trans>Could not load members.</Trans>
      </p>
    );
  }
  return (
    <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
      {members.data.members.map((m) => (
        <li
          key={m.user_id}
          className="flex items-center justify-between gap-3 py-3"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="font-medium">{m.display_name}</span>
          <RoleBadge role={m.role} />
        </li>
      ))}
    </ul>
  );
}
