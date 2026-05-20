import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { CopyButton } from '../components/CopyButton';
import { RequireAuth } from '../components/RequireAuth';
import { RoleBadge } from '../components/RoleBadge';
import { TopBar } from '../components/shell/TopBar';
import { Button } from '../components/ui/Button';
import { useIssueInvite, useProjectInvites, useRevokeInvite } from '../lib/invites';
import { useProject } from '../lib/projects';

export const Route = createFileRoute('/p/$slug/invites')({
  component: () => (
    <RequireAuth>
      <InvitesPage />
    </RequireAuth>
  ),
});

function InvitesPage() {
  const { _ } = useLingui();
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const project = useProject(slug);
  const invites = useProjectInvites(slug);
  const issue = useIssueInvite();
  const revoke = useRevokeInvite();

  const [role, setRole] = useState<'member' | 'observer'>('member');
  const [days, setDays] = useState(7);
  const [maxUses, setMaxUses] = useState<number | ''>(1);

  const canIssue = project.data && (project.data.role === 'owner' || project.data.role === 'admin');

  async function onIssue() {
    await issue.mutateAsync({
      slug,
      role,
      expiresInDays: days,
      maxUses: typeof maxUses === 'number' ? maxUses : undefined,
    });
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <TopBar
        title={<Trans>Invites</Trans>}
        eyebrow={project.data?.project.name ?? slug}
        onBack={() => void navigate({ to: '/p/$slug/manage', params: { slug } })}
      />
      <section className="flex flex-col gap-6 px-4 pt-4 pb-8">
        {canIssue ? (
          <div
            className="flex flex-col gap-3 rounded-2xl border p-4"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            <h2 className="text-base font-semibold">
              <Trans>Issue a new invite</Trans>
            </h2>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <label className="flex flex-col gap-1">
                <span style={{ color: 'var(--text-muted)' }}>
                  <Trans>Role</Trans>
                </span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'member' | 'observer')}
                  className="min-h-[40px] rounded-lg border px-2"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="member">{_(t`Member`)}</option>
                  <option value="observer">{_(t`Observer`)}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span style={{ color: 'var(--text-muted)' }}>
                  <Trans>Expires in (days)</Trans>
                </span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="min-h-[40px] rounded-lg border px-2"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                  }}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span style={{ color: 'var(--text-muted)' }}>
                  <Trans>Max uses</Trans>
                </span>
                <input
                  type="number"
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value === '' ? '' : Number(e.target.value))}
                  className="min-h-[40px] rounded-lg border px-2"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                  }}
                />
              </label>
            </div>
            <Button onClick={onIssue} disabled={issue.isPending}>
              <Trans>Issue invite</Trans>
            </Button>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Trans>Only owners and admins can issue invites.</Trans>
          </p>
        )}

        <h2 className="text-base font-semibold">
          <Trans>Active invites</Trans>
        </h2>
        {invites.isLoading ? (
          <p style={{ color: 'var(--text-muted)' }}>
            <Trans>Loading…</Trans>
          </p>
        ) : invites.data?.invites.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            <Trans>No invites yet.</Trans>
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {invites.data?.invites
              .filter((i) => !i.revoked_at)
              .map((inv) => {
                const url = `${origin}/i/${inv.token}`;
                return (
                  <li
                    key={inv.id}
                    className="flex flex-col gap-2 rounded-2xl border p-4"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <RoleBadge role={inv.role as 'member' | 'observer'} />
                      <span style={{ color: 'var(--text-muted)' }}>
                        <Trans>uses</Trans> {inv.use_count}
                        {inv.max_uses ? ` / ${inv.max_uses}` : ''}
                      </span>
                      {inv.expires_at && (
                        <span style={{ color: 'var(--text-muted)' }}>
                          · <Trans>expires</Trans> {new Date(inv.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {url}
                      </code>
                      <CopyButton text={url} label={_(t`Copy URL`)} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="font-mono text-xl tracking-widest">{inv.code}</code>
                      <CopyButton text={inv.code} label={_(t`Copy code`)} />
                    </div>
                    {canIssue && (
                      <Button
                        variant="secondary"
                        onClick={() => revoke.mutate({ slug, inviteId: inv.id })}
                        disabled={revoke.isPending}
                      >
                        <Trans>Revoke</Trans>
                      </Button>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </div>
  );
}
