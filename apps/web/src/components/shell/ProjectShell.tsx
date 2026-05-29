import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';

import { useUnreadByProject } from '../../lib/inbox';
import { useProject } from '../../lib/projects';
import { ProjectHeader } from './ProjectHeader';
import { ProjectTopSheet } from './ProjectTopSheet';
import { type Tab, TabBar } from './TabBar';
import { useHideOnScroll } from './useHideOnScroll';

interface ProjectShellProps {
  slug: string;
  tab: Tab;
  pageTitle: ReactNode;
  children: ReactNode;
  /** Contextual row under the title (topic chips, alternatives, …). */
  subsection?: ReactNode;
  /** When set, the header shows a back chevron at the far left. */
  onBack?: () => void;
}

/**
 * Wrapper that composes the project-scoped header, the bottom tab bar, and
 * the project switcher. The header + tab bar slide out of view on scroll-down
 * and return on scroll-up. Used by every project page — tab routes and
 * detail pages alike.
 */
export function ProjectShell({
  slug,
  tab,
  pageTitle,
  children,
  subsection,
  onBack,
}: ProjectShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const project = useProject(slug);
  const navigate = useNavigate();
  const projectName = project.data?.project.name ?? slug;
  const hidden = useHideOnScroll();
  const unreadByProject = useUnreadByProject();
  const otherUnread = Object.entries(unreadByProject).some(([s, n]) => s !== slug && n > 0);

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <ProjectHeader
        projectName={projectName}
        pageTitle={pageTitle}
        subsection={subsection}
        otherUnread={otherUnread}
        onBack={onBack}
        hidden={hidden}
        onAvatarClick={() => void navigate({ to: '/preferences' })}
        onProjectClick={() => setSheetOpen(true)}
      />
      <main className="flex flex-1 flex-col">{children}</main>
      <TabBar slug={slug} current={tab} hidden={hidden} />
      <ProjectTopSheet open={sheetOpen} onOpenChange={setSheetOpen} currentSlug={slug} />
    </div>
  );
}
