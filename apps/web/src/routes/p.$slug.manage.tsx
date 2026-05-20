import { Trans } from '@lingui/macro';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';

import { RequireAuth } from '../components/RequireAuth';
import { RoleBadge } from '../components/RoleBadge';
import { TopBar } from '../components/shell/TopBar';
import { useMembers, useProject } from '../lib/projects';

export const Route = createFileRoute('/p/$slug/manage')({
  component: () => (
    <RequireAuth>
      <ManagePage />
    </RequireAuth>
  ),
});

function ManagePage() {
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
        title={<Trans>Manage</Trans>}
        eyebrow={project.data?.project.name ?? slug}
        onBack={() => void navigate({ to: '/p/$slug', params: { slug } })}
      />

      <section className="flex flex-col gap-1 px-4 pt-5">
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 500,
            color: 'var(--ink)',
            letterSpacing: -0.3,
            lineHeight: 1.15,
            fontVariationSettings: '"opsz" 32',
          }}
        >
          {project.data?.project.name ?? slug}
        </h1>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--ink-muted)',
            }}
          >
            /{slug}
          </span>
          {project.data && (
            <>
              <span style={{ color: 'var(--border-hi)' }}>·</span>
              <RoleBadge
                role={project.data.role as 'owner' | 'admin' | 'moderator' | 'member' | 'observer'}
              />
            </>
          )}
        </div>
      </section>

      <nav className="mt-6 flex flex-col gap-2 px-4 pb-8">
        <ManageLink
          to="/p/$slug/members"
          params={{ slug }}
          title={<Trans>Members</Trans>}
          subtitle={
            members.data ? <Trans>{members.data.members.length} people</Trans> : <Trans>—</Trans>
          }
        />
        <ManageLink
          to="/p/$slug/invites"
          params={{ slug }}
          title={<Trans>Invites</Trans>}
          subtitle={<Trans>Issue and revoke invitations</Trans>}
        />
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'var(--surface)',
            border: '0.5px solid var(--border)',
            opacity: 0.5,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            <Trans>Project settings</Trans>
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
            <Trans>Coming soon</Trans>
          </div>
        </div>
      </nav>
    </div>
  );
}

interface ManageLinkProps {
  to: '/p/$slug/members' | '/p/$slug/invites';
  params: { slug: string };
  title: React.ReactNode;
  subtitle: React.ReactNode;
}

function ManageLink({ to, params, title, subtitle }: ManageLinkProps) {
  return (
    <Link
      to={to}
      params={params}
      className="flex items-center justify-between gap-3 rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
          {title}
        </div>
        <div className="mt-1 text-xs" style={{ color: 'var(--ink-muted)' }}>
          {subtitle}
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M5 3l4 4-4 4"
          stroke="var(--ink-muted)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
