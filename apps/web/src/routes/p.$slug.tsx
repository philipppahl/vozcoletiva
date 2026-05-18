import { Trans } from '@lingui/macro';
import { createFileRoute, Link, Outlet } from '@tanstack/react-router';

import { RequireAuth } from '../components/RequireAuth';
import { RoleBadge } from '../components/RoleBadge';
import { useProject } from '../lib/projects';

export const Route = createFileRoute('/p/$slug')({
  component: () => (
    <RequireAuth>
      <ProjectLayout />
    </RequireAuth>
  ),
});

function ProjectLayout() {
  const { slug } = Route.useParams();
  const project = useProject(slug);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8">
      <header className="flex flex-col gap-3 pb-6">
        <Link to="/" className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>
          <Trans>← All projects</Trans>
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.data?.project.name ?? slug}
          </h1>
          {project.data && (
            <RoleBadge
              role={project.data.role as 'owner' | 'admin' | 'moderator' | 'member' | 'observer'}
            />
          )}
        </div>
        <nav
          className="flex items-center gap-1 self-start rounded-full border p-1"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <TabLink to="/p/$slug" params={{ slug }} exact>
            <Trans>Overview</Trans>
          </TabLink>
          <TabLink to="/p/$slug/members" params={{ slug }}>
            <Trans>Members</Trans>
          </TabLink>
          <TabLink to="/p/$slug/invites" params={{ slug }}>
            <Trans>Invites</Trans>
          </TabLink>
        </nav>
      </header>
      <Outlet />
    </main>
  );
}

function TabLink({
  to,
  params,
  exact,
  children,
}: {
  to: '/p/$slug' | '/p/$slug/members' | '/p/$slug/invites';
  params: { slug: string };
  exact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      params={params}
      activeOptions={{ exact }}
      className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
      activeProps={{
        style: { background: 'var(--brand)', color: '#ffffff' },
      }}
      inactiveProps={{
        style: { color: 'var(--text-primary)' },
      }}
    >
      {children}
    </Link>
  );
}
