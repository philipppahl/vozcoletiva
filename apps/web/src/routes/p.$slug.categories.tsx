import { Trans } from '@lingui/macro';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { CategoryManager } from '../components/categories/CategoryManager';
import { RequireAuth } from '../components/RequireAuth';
import { TopBar } from '../components/shell/TopBar';
import { useProject } from '../lib/projects';

export const Route = createFileRoute('/p/$slug/categories')({
  component: () => (
    <RequireAuth>
      <CategoriesPage />
    </RequireAuth>
  ),
});

function CategoriesPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const project = useProject(slug);
  const role = project.data?.role;
  const canManage = role === 'owner' || role === 'admin';

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <TopBar
        title={<Trans>Topics</Trans>}
        eyebrow={project.data?.project.name ?? slug}
        onBack={() => void navigate({ to: '/p/$slug/manage', params: { slug } })}
      />
      {!canManage ? (
        <p className="px-6 py-10 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
          <Trans>Only owners and admins can manage topics.</Trans>
        </p>
      ) : (
        <CategoryManager slug={slug} />
      )}
    </div>
  );
}
