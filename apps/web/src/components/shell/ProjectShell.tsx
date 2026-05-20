import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';

import { useProject } from '../../lib/projects';
import { ProjectHeader } from './ProjectHeader';
import { ProjectTopSheet } from './ProjectTopSheet';
import { type Tab, TabBar } from './TabBar';

interface ProjectShellProps {
  slug: string;
  tab: Tab;
  pageTitle: ReactNode;
  children: ReactNode;
}

/**
 * Wrapper that composes the project-scoped header, the tab bar at the
 * bottom, and the top sheet for project switching. Used by every tab route
 * (Proposals / Documents / Messages / Search).
 */
export function ProjectShell({ slug, tab, pageTitle, children }: ProjectShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const project = useProject(slug);
  const navigate = useNavigate();
  const projectName = project.data?.project.name ?? slug;

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <ProjectHeader
        projectName={projectName}
        pageTitle={pageTitle}
        onAvatarClick={() => void navigate({ to: '/preferences' })}
        onProjectClick={() => setSheetOpen(true)}
      />
      <main className="flex flex-1 flex-col">{children}</main>
      <TabBar slug={slug} current={tab} />
      <ProjectTopSheet open={sheetOpen} onOpenChange={setSheetOpen} currentSlug={slug} />
    </div>
  );
}
