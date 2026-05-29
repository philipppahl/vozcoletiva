import { Trans } from '@lingui/macro';
import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { useUnreadByProject } from '../../lib/inbox';
import { useProjects } from '../../lib/projects';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';

type Role = 'owner' | 'admin' | 'moderator' | 'member' | 'observer';

const ROLE_LABEL: Record<Role, ReactElement> = {
  owner: <Trans>Owner</Trans>,
  admin: <Trans>Admin</Trans>,
  moderator: <Trans>Moderator</Trans>,
  member: <Trans>Member</Trans>,
  observer: <Trans>Observer</Trans>,
};

interface ProjectTopSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSlug: string;
}

/**
 * Top sheet anchored to the project header. A compact single list of all
 * projects — the current one is marked + offers a Manage (gear) action,
 * others tap to switch. A tiny dot flags any project with unread inbox
 * items. New / Join sit at the bottom.
 */
export function ProjectTopSheet({ open, onOpenChange, currentSlug }: ProjectTopSheetProps) {
  const navigate = useNavigate();
  const projects = useProjects();
  const unreadByProject = useUnreadByProject();
  const items = projects.data?.projects ?? [];
  // Current project first, then the rest in their existing order.
  const ordered = [
    ...items.filter((p) => p.project.slug === currentSlug),
    ...items.filter((p) => p.project.slug !== currentSlug),
  ];

  const close = () => onOpenChange(false);
  const canManage = (role: string) => role === 'owner' || role === 'admin';

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={<Trans>Switch project</Trans>} side="top">
      <ul className="flex flex-col gap-1.5 px-3 pb-2">
        {ordered.map((entry) => {
          const isCurrent = entry.project.slug === currentSlug;
          const hasUnread = (unreadByProject[entry.project.slug] ?? 0) > 0;
          return (
            <li key={entry.project.id}>
              <div
                className="flex items-center gap-3 rounded-2xl py-3.5 pl-4 pr-2"
                style={{
                  background: isCurrent ? 'var(--surface-2)' : 'transparent',
                  border: `1px solid ${isCurrent ? 'var(--border)' : 'transparent'}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    close();
                    if (!isCurrent) {
                      void navigate({ to: '/p/$slug', params: { slug: entry.project.slug } });
                    }
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="truncate"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 17,
                          fontWeight: 500,
                          color: 'var(--ink)',
                          lineHeight: 1.2,
                          letterSpacing: -0.2,
                          fontVariationSettings: '"opsz" 24',
                        }}
                      >
                        {entry.project.name}
                      </span>
                      {hasUnread && !isCurrent && (
                        <span
                          aria-hidden="true"
                          className="inline-block flex-shrink-0 rounded-full"
                          style={{ width: 7, height: 7, background: 'var(--accent)' }}
                        />
                      )}
                    </div>
                    <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--ink-muted)' }}>
                      {isCurrent && (
                        <>
                          <Trans>Current</Trans>
                          {' · '}
                        </>
                      )}
                      {ROLE_LABEL[entry.role as Role] ?? entry.role}
                    </div>
                  </div>
                </button>
                {isCurrent && canManage(entry.role) ? (
                  <button
                    type="button"
                    aria-label="Manage project"
                    onClick={() => {
                      close();
                      void navigate({
                        to: '/p/$slug/manage',
                        params: { slug: entry.project.slug },
                      });
                    }}
                    className="flex-shrink-0 rounded-full"
                    style={{
                      padding: 8,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ink-soft)',
                    }}
                  >
                    <GearIcon />
                  </button>
                ) : !isCurrent ? (
                  <span className="flex-shrink-0 pr-2" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path
                        d="M5 3l4 4-4 4"
                        stroke="var(--ink-muted)"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                ) : (
                  <span className="w-2 flex-shrink-0" />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex gap-2 px-3 pb-1">
        <Button
          variant="secondary"
          block
          onClick={() => {
            close();
            void navigate({ to: '/projects/new' });
          }}
        >
          <Trans>New project</Trans>
        </Button>
        <Button
          variant="secondary"
          block
          onClick={() => {
            close();
            void navigate({ to: '/join' });
          }}
        >
          <Trans>Join with code</Trans>
        </Button>
      </div>
    </Sheet>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
