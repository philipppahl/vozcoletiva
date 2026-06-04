import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';

import { useUnreadByProject } from '../../lib/inbox';
import { useProject } from '../../lib/projects';
import { useKeyboardInset } from '../../lib/useKeyboardInset';
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
  // Scroll happens inside `scrollEl`, not the document — a fixed h-dvh frame
  // with no document scroll, so the sticky header/footer can't drift on
  // overscroll (the rubber-band that pushed the tab bar around). The header +
  // tab bar still slide in/out on scroll, now driven by this container.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const hidden = useHideOnScroll(scrollEl);
  // While the soft keyboard is open (composing a comment), keep the tab bar
  // hidden — it otherwise covers the composer and pops back on scroll-up. The
  // header keeps its normal scroll behaviour.
  const keyboardOpen = useKeyboardInset() > 0;
  const footerHidden = hidden || keyboardOpen;
  const unreadByProject = useUnreadByProject();
  const otherUnread = Object.entries(unreadByProject).some(([s, n]) => s !== slug && n > 0);

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div
        ref={setScrollEl}
        className="flex flex-1 flex-col overflow-y-auto"
        style={{ minHeight: 0, overscrollBehavior: 'contain' }}
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
        <TabBar slug={slug} current={tab} hidden={footerHidden} />
      </div>
      <ProjectTopSheet open={sheetOpen} onOpenChange={setSheetOpen} currentSlug={slug} />
    </div>
  );
}
