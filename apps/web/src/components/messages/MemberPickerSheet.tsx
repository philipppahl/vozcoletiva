import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { useAuth } from '../../lib/auth/hooks';
import { useStartDm } from '../../lib/messages';
import { useMembers, useProjects } from '../../lib/projects';
import { Avatar } from '../shell/Avatar';
import { Sheet } from '../ui/Sheet';

interface MemberPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Start a DM" picker. Sourced from members of any project the viewer
 * shares with the candidate (cross-project reach), filtered live by name.
 */
export function MemberPickerSheet({ open, onOpenChange }: MemberPickerSheetProps) {
  const { _ } = useLingui();
  const { session } = useAuth();
  const navigate = useNavigate();
  const projects = useProjects();
  const startDm = useStartDm();
  const [query, setQuery] = useState('');

  const projectSlugs = projects.data?.projects.map((p) => p.project.slug) ?? [];
  const candidates = useCrossProjectMembers(projectSlugs, session?.userId);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? candidates.filter((c) => c.display_name.toLowerCase().includes(q))
    : candidates;

  async function onPick(userId: string) {
    const conv = await startDm.mutateAsync(userId);
    onOpenChange(false);
    void navigate({ to: '/dms/$id', params: { id: conv.id } });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      side="bottom"
      title={<Trans>New direct message</Trans>}
      hideTitle={false}
    >
      <div className="px-4 pt-2 pb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={_(t`Search people`)}
          className="h-11 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--field-bg)',
            color: 'var(--ink)',
            border: '1px solid transparent',
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
          }}
        />
      </div>
      <ul
        className="mx-4 mb-3 overflow-hidden rounded-2xl"
        style={{ background: 'var(--surface-2)' }}
      >
        {filtered.length === 0 ? (
          <li className="px-4 py-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
            <Trans>No matches.</Trans>
          </li>
        ) : (
          filtered.map((m, i) => (
            <li
              key={m.user_id}
              style={{
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={() => void onPick(m.user_id)}
                disabled={startDm.isPending}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Avatar displayName={m.display_name} size={36} />
                <span
                  className="flex-1 truncate text-sm font-medium"
                  style={{ color: 'var(--ink)' }}
                >
                  {m.display_name}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </Sheet>
  );
}

interface CrossProjectMember {
  user_id: string;
  display_name: string;
}

/**
 * Aggregates members from every project the viewer is in. Deduplicates by
 * user id; excludes the viewer. Uses each project's useMembers hook —
 * fine at MVP scale, swap for a single `/v1/me/contacts` endpoint later.
 */
function useCrossProjectMembers(
  projectSlugs: string[],
  viewerId: string | undefined,
): CrossProjectMember[] {
  // Pulling member lists in parallel: limited to the first 5 projects to keep
  // the hook count bounded.
  const limited = projectSlugs.slice(0, 5);
  const m0 = useMembers(limited[0]);
  const m1 = useMembers(limited[1]);
  const m2 = useMembers(limited[2]);
  const m3 = useMembers(limited[3]);
  const m4 = useMembers(limited[4]);

  const all = [m0, m1, m2, m3, m4]
    .flatMap((r) => r.data?.members ?? [])
    .filter((m) => m.user_id !== viewerId);
  const seen = new Set<string>();
  const out: CrossProjectMember[] = [];
  for (const m of all) {
    if (seen.has(m.user_id)) continue;
    seen.add(m.user_id);
    out.push({ user_id: m.user_id, display_name: m.display_name });
  }
  out.sort((a, b) => a.display_name.localeCompare(b.display_name));
  return out;
}
