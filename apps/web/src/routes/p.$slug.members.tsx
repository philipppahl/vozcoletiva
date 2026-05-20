import { Trans } from '@lingui/macro';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RequireAuth } from '../components/RequireAuth';
import { RoleBadge } from '../components/RoleBadge';
import { Avatar } from '../components/shell/Avatar';
import { TopBar } from '../components/shell/TopBar';
import { useMembers, useProject } from '../lib/projects';

export const Route = createFileRoute('/p/$slug/members')({
  component: () => (
    <RequireAuth>
      <MembersPage />
    </RequireAuth>
  ),
});

function MembersPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const project = useProject(slug);
  const members = useMembers(slug);

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <TopBar
        title={<Trans>Members</Trans>}
        eyebrow={project.data?.project.name ?? slug}
        onBack={() => void navigate({ to: '/p/$slug/manage', params: { slug } })}
      />

      <section className="px-4 pt-4 pb-8">
        {members.isLoading ? (
          <p style={{ color: 'var(--ink-muted)' }}>
            <Trans>Loading…</Trans>
          </p>
        ) : members.error || !members.data ? (
          <p style={{ color: 'var(--no)' }}>
            <Trans>Could not load members.</Trans>
          </p>
        ) : (
          <ul
            className="overflow-hidden rounded-2xl"
            style={{
              background: 'var(--surface)',
              border: '0.5px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {members.data.members.map((m, i) => (
              <li
                key={m.user_id}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <Avatar displayName={m.display_name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {m.display_name}
                  </div>
                </div>
                <RoleBadge role={m.role} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
