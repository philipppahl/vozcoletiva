import { Trans } from '@lingui/macro';
import { createFileRoute } from '@tanstack/react-router';

import { useMembers, useProject } from '../lib/projects';

export const Route = createFileRoute('/p/$slug/')({
  component: ProjectOverview,
});

function ProjectOverview() {
  const { slug } = Route.useParams();
  const project = useProject(slug);
  const members = useMembers(slug);

  if (project.isLoading) {
    return (
      <p style={{ color: 'var(--text-muted)' }}>
        <Trans>Loading…</Trans>
      </p>
    );
  }
  if (project.error || !project.data) {
    return (
      <p style={{ color: 'var(--color-danger)' }}>
        <Trans>Could not load this project.</Trans>
      </p>
    );
  }

  const { project: p } = project.data;

  return (
    <section className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt style={{ color: 'var(--text-muted)' }}>
          <Trans>Slug</Trans>
        </dt>
        <dd className="font-mono">{p.slug}</dd>
        <dt style={{ color: 'var(--text-muted)' }}>
          <Trans>Template</Trans>
        </dt>
        <dd>{p.template}</dd>
        <dt style={{ color: 'var(--text-muted)' }}>
          <Trans>Visibility</Trans>
        </dt>
        <dd>{p.visibility}</dd>
        <dt style={{ color: 'var(--text-muted)' }}>
          <Trans>Members</Trans>
        </dt>
        <dd>{members.data?.members.length ?? '…'}</dd>
      </dl>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Trans>
          Topics, proposals, comments, and the document library land in upcoming plan-feature
          cycles. For now: invite people and watch them show up in the Members tab.
        </Trans>
      </p>
    </section>
  );
}
