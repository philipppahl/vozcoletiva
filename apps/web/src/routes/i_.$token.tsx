import { Trans } from '@lingui/macro';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';

import { Logo } from '../components/Logo';
import { RequireAuth } from '../components/RequireAuth';
import { RoleBadge } from '../components/RoleBadge';
import { Button } from '../components/ui/Button';
import { useAcceptInvite, useInviteByToken } from '../lib/invites';

export const Route = createFileRoute('/i_/$token')({
  component: () => (
    <RequireAuth>
      <AcceptInvitePage />
    </RequireAuth>
  ),
});

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const preview = useInviteByToken(token);
  const accept = useAcceptInvite();

  async function onAccept() {
    const result = await accept.mutateAsync(token);
    navigate({ to: '/p/$slug', params: { slug: result.project.slug } });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <Logo />
      <h1 className="text-2xl font-semibold tracking-tight">
        <Trans>You're invited</Trans>
      </h1>

      {preview.isLoading && (
        <p style={{ color: 'var(--text-muted)' }}>
          <Trans>Loading…</Trans>
        </p>
      )}

      {preview.error && (
        <p style={{ color: 'var(--color-danger)' }}>
          <Trans>That invite link doesn't seem to exist anymore.</Trans>
        </p>
      )}

      {preview.data && (
        <div
          className="flex w-full flex-col items-center gap-4 rounded-2xl border p-6"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <p className="text-lg font-semibold">{preview.data.project_name}</p>
          <div
            className="flex items-center gap-2 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Trans>You'll join as</Trans>{' '}
            <RoleBadge
              role={preview.data.role as 'owner' | 'admin' | 'moderator' | 'member' | 'observer'}
            />
          </div>
          {preview.data.expires_at && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <Trans>This link expires</Trans> {new Date(preview.data.expires_at).toLocaleString()}
            </p>
          )}

          {!preview.data.valid && (
            <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
              <Trans>This invite is no longer valid.</Trans>
            </p>
          )}

          <Button onClick={onAccept} disabled={!preview.data.valid || accept.isPending}>
            <Trans>Accept invite</Trans>
          </Button>

          <Link to="/" className="text-xs font-semibold" style={{ color: 'var(--brand)' }}>
            <Trans>Not now</Trans>
          </Link>
        </div>
      )}
    </main>
  );
}
