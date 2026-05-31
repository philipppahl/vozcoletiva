import { Trans } from '@lingui/macro';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Logo } from '../components/Logo';
import { RoleBadge } from '../components/RoleBadge';
import { Avatar } from '../components/shell/Avatar';
import { BellButton } from '../components/shell/BellButton';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../lib/auth/hooks';
import { isOnboardingComplete } from '../lib/onboarding';
import { useProjects } from '../lib/projects';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { status, session } = useAuth();
  return status === 'signed-in' && session ? <SignedInView /> : <SignedOutView />;
}

function SignedOutView() {
  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-6 py-12"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <Logo size={64} />
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 400,
          letterSpacing: -0.3,
          color: 'var(--ink)',
          fontVariationSettings: '"opsz" 36',
        }}
      >
        <Trans>vozcoletiva</Trans>
      </h1>
      <p className="text-center text-base" style={{ color: 'var(--ink-soft)' }}>
        <Trans>Structured collective decision-making.</Trans>
      </p>
      <div className="mt-2 flex flex-col items-center gap-3">
        <Link to="/sign-up">
          <Button variant="primary" size="lg">
            <Trans>Create an account</Trans>
          </Button>
        </Link>
        <Link to="/sign-in" className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
          <Trans>Sign in</Trans>
        </Link>
      </div>
    </main>
  );
}

function SignedInView() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const projects = useProjects();

  // First-launch welcome: signed in, no memberships, never dismissed onboarding.
  // Gated on the projects query having actually returned (not loading) so we
  // don't flicker for returning users with projects.
  useEffect(() => {
    if (!projects.isSuccess) return;
    if (projects.data.projects.length > 0) return;
    if (isOnboardingComplete()) return;
    void navigate({ to: '/welcome' });
  }, [projects.isSuccess, projects.data, navigate]);

  if (!session) return null;

  const items = projects.data?.projects ?? [];
  const hasProjects = items.length > 0;

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <header className="flex items-center justify-between px-5 pt-8">
        <Logo size={26} />
        <div className="flex items-center gap-1">
          <BellButton />
          <button
            type="button"
            onClick={() => void navigate({ to: '/preferences' })}
            aria-label="Open preferences"
            className="rounded-full"
            style={{ padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <Avatar displayName={session.displayName} size={36} ring="var(--surface)" />
          </button>
        </div>
      </header>

      <h1
        className="px-5"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 400,
          letterSpacing: -0.4,
          color: 'var(--ink)',
          lineHeight: 1.05,
          fontVariationSettings: '"opsz" 36',
        }}
      >
        <Trans>Your projects</Trans>
      </h1>

      <section className="flex flex-col gap-3 px-4">
        {hasProjects ? (
          items.map((entry) => (
            <Link
              key={entry.project.id}
              to="/p/$slug"
              params={{ slug: entry.project.slug }}
              className="block"
            >
              <Card>
                <div className="flex items-baseline justify-between gap-2">
                  <h2
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 22,
                      fontWeight: 500,
                      lineHeight: 1.2,
                      color: 'var(--ink)',
                      letterSpacing: -0.3,
                      fontVariationSettings: '"opsz" 36',
                    }}
                  >
                    {entry.project.name}
                  </h2>
                  <RoleBadge
                    role={entry.role as 'owner' | 'admin' | 'moderator' | 'member' | 'observer'}
                  />
                </div>
                <div className="mt-1 font-mono text-xs" style={{ color: 'var(--ink-muted)' }}>
                  /{entry.project.slug}
                </div>
              </Card>
            </Link>
          ))
        ) : (
          <p className="text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
            <Trans>You don't have any projects yet.</Trans>
          </p>
        )}
      </section>

      <div className="flex flex-col items-center gap-3 px-4 pb-12 pt-2">
        <Link to="/projects/new">
          <Button variant="primary" size="lg">
            <Trans>Create a project</Trans>
          </Button>
        </Link>
        <Link to="/join" className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
          <Trans>Got an invite code?</Trans>
        </Link>
      </div>
    </main>
  );
}
