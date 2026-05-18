import { Trans } from '@lingui/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { Theme } from '@vozcoletiva/shared';
import { useEffect } from 'react';
import { Logo } from '../components/Logo';
import { RoleBadge } from '../components/RoleBadge';
import { Button } from '../components/ui/Button';
import { apiClient } from '../lib/api';
import { useAuth } from '../lib/auth/hooks';
import { useProjects } from '../lib/projects';
import { useThemeStore } from '../lib/theme';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { status, session } = useAuth();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-8 px-6 py-12">
      <Logo size={64} />
      <h1 className="text-3xl font-semibold tracking-tight">
        <Trans>vozcoletiva</Trans>
      </h1>
      <p className="text-center text-base" style={{ color: 'var(--text-secondary)' }}>
        <Trans>Structured collective decision-making.</Trans>
      </p>

      {status === 'signed-in' && session ? <SignedInView /> : <SignedOutCtas />}

      <ThemeToggle />
    </main>
  );
}

function SignedOutCtas() {
  return (
    <div className="flex flex-col items-center gap-3">
      <Link to="/sign-up">
        <Button>
          <Trans>Create an account</Trans>
        </Button>
      </Link>
      <Link to="/sign-in" className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
        <Trans>Sign in</Trans>
      </Link>
    </div>
  );
}

function SignedInView() {
  const { session, signOut } = useAuth();
  const projects = useProjects();

  // First-launch profile seed: hit /v1/me with our local display name so the
  // user's USER#<sub>/PROFILE row is created with the right name. Without this,
  // accept_invite and create_project's display-name fallback would seed it as
  // the Cognito sub. Fires once per mount; the BE call is idempotent.
  useEffect(() => {
    if (!session) return;
    void apiClient.GET('/v1/me', {
      params: { query: { display_name: session.displayName } },
    });
  }, [session]);

  if (!session) return null;
  const displayName = session.displayName;

  const items = projects.data?.projects ?? [];
  const hasProjects = items.length > 0;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <p className="text-base">
        <Trans>Hello, {displayName}</Trans>
      </p>

      {hasProjects ? (
        <section className="flex w-full flex-col gap-3">
          <h2
            className="text-sm font-semibold uppercase tracking-wide"
            style={{ color: 'var(--text-muted)' }}
          >
            <Trans>Your projects</Trans>
          </h2>
          <ul className="flex flex-col gap-2">
            {items.map((entry) => (
              <li key={entry.project.id}>
                <Link
                  to="/p/$slug"
                  params={{ slug: entry.project.slug }}
                  className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{entry.project.name}</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
                      /{entry.project.slug}
                    </span>
                  </div>
                  <RoleBadge
                    role={entry.role as 'owner' | 'admin' | 'moderator' | 'member' | 'observer'}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Trans>You don't have any projects yet.</Trans>
        </p>
      )}

      <div className="flex flex-col items-center gap-2">
        <Link to="/projects/new">
          <Button>
            <Trans>Create a project</Trans>
          </Button>
        </Link>
        <Link to="/join" className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
          <Trans>Got an invite code?</Trans>
        </Link>
      </div>

      <Button variant="secondary" onClick={signOut}>
        <Trans>Sign out</Trans>
      </Button>
    </div>
  );
}

const THEMES: readonly Theme[] = ['system', 'light', 'dark'] as const;

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <div
      className="flex items-center gap-1 rounded-full border p-1"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      role="radiogroup"
      aria-label="Theme"
    >
      {THEMES.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTheme(t)}
          aria-pressed={theme === t}
          className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background: theme === t ? 'var(--brand)' : 'transparent',
            color: theme === t ? '#ffffff' : 'var(--text-primary)',
            minHeight: '44px',
            minWidth: '44px',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
