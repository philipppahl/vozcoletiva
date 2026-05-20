import { Trans } from '@lingui/macro';
import { useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';

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
 * Top sheet anchored to the project header. Shows the current project block
 * (with a "Manage" action), then a list of other projects, then a pair of
 * new/join buttons. Members + Invite live under Manage.
 */
export function ProjectTopSheet({ open, onOpenChange, currentSlug }: ProjectTopSheetProps) {
  const navigate = useNavigate();
  const projects = useProjects();
  const items = projects.data?.projects ?? [];
  const current = items.find((p) => p.project.slug === currentSlug);
  const others = items.filter((p) => p.project.slug !== currentSlug);

  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={<Trans>Switch project</Trans>} side="top">
      {current && (
        <section className="px-4 pb-3">
          <h3
            className="mb-2 text-[10.5px] font-semibold uppercase"
            style={{ color: 'var(--ink-muted)', letterSpacing: 0.06 }}
          >
            <Trans>Current project</Trans>
          </h3>
          <div
            className="rounded-2xl p-4"
            style={{
              background: 'var(--surface-2)',
              border: '0.5px solid var(--border)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 19,
                fontWeight: 500,
                color: 'var(--ink)',
                lineHeight: 1.2,
                letterSpacing: -0.2,
                fontVariationSettings: '"opsz" 28',
              }}
            >
              {current.project.name}
            </div>
            <div className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
              {ROLE_LABEL[current.role as Role] ?? current.role}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  close();
                  void navigate({ to: '/p/$slug/manage', params: { slug: current.project.slug } });
                }}
              >
                <Trans>Manage</Trans>
              </Button>
            </div>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="px-4 pt-2">
          <h3
            className="mb-2 text-[10.5px] font-semibold uppercase"
            style={{ color: 'var(--ink-muted)', letterSpacing: 0.06 }}
          >
            <Trans>Other projects</Trans>
          </h3>
          <ul className="overflow-hidden rounded-2xl" style={{ background: 'var(--surface-2)' }}>
            {others.map((entry, i) => (
              <li
                key={entry.project.id}
                style={{
                  borderBottom: i === others.length - 1 ? 'none' : '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    close();
                    void navigate({ to: '/p/$slug', params: { slug: entry.project.slug } });
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
                      {entry.project.name}
                    </div>
                    <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--ink-muted)' }}>
                      {ROLE_LABEL[entry.role as Role] ?? entry.role}
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
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-4 flex gap-2 px-4">
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
