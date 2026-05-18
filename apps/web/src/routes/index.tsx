import { Trans } from '@lingui/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { Theme } from '@vozcoletiva/shared';
import { useEffect, useState } from 'react';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { apiClient } from '../lib/api';
import { useAuth } from '../lib/auth/hooks';
import { useThemeStore } from '../lib/theme';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { status, session } = useAuth();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
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
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { error } = await apiClient.GET('/v1/me', {
        params: { query: { display_name: session.displayName } },
      });
      if (!cancelled && error) setProfileError(JSON.stringify(error));
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session) return null;
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-base">
        <Trans>Hello, {session.displayName}</Trans>
      </p>
      {profileError && (
        <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
          /v1/me error: {profileError}
        </p>
      )}
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
