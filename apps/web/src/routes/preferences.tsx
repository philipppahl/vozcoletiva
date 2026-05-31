import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import type { Locale, Theme } from '@vozcoletiva/shared';
import { useEffect, useState } from 'react';
import { RequireAuth } from '../components/RequireAuth';
import { Avatar } from '../components/shell/Avatar';
import { TopBar } from '../components/shell/TopBar';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { setLocale } from '../i18n';
import { useAuth } from '../lib/auth/hooks';
import { useUpdateDisplayName } from '../lib/profile';
import { useThemeStore } from '../lib/theme';
import { ScenarioPicker } from '../mocks/ScenarioPicker';

export const Route = createFileRoute('/preferences')({
  component: () => (
    <RequireAuth>
      <PreferencesPage />
    </RequireAuth>
  ),
});

const THEMES: readonly Theme[] = ['system', 'light', 'dark'] as const;
const LOCALES: readonly Locale[] = ['en', 'pt'] as const;

function PreferencesPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [lang, setLang] = useState<Locale>('en');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setLang((document.documentElement.lang || 'en') as Locale);
    }
  }, []);

  const onLang = (next: Locale) => {
    setLang(next);
    setLocale(next);
  };

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <TopBar
        title={<Trans>Preferences</Trans>}
        onBack={() => (router.history.canGoBack() ? router.history.back() : navigate({ to: '/' }))}
      />

      <section className="flex flex-col items-center px-6 pt-6 pb-4 text-center">
        <Avatar displayName={session?.displayName ?? '?'} size={84} ring="var(--surface)" />
        <h2
          className="mt-3"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 400,
            color: 'var(--ink)',
            letterSpacing: -0.3,
            fontVariationSettings: '"opsz" 36',
          }}
        >
          {session?.displayName ?? ''}
        </h2>
        <div className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          {session?.email ?? ''}
        </div>
      </section>

      <section className="px-4 pt-2">
        <PrefHeading>
          <Trans>Profile</Trans>
        </PrefHeading>
        <PrefCard>
          <DisplayNameField />
        </PrefCard>
      </section>

      <section className="px-4 pt-6">
        <PrefHeading>
          <Trans>Settings</Trans>
        </PrefHeading>
        <PrefCard>
          <PrefRow label={<Trans>Theme</Trans>}>
            <SegRow
              value={theme}
              onChange={setTheme}
              options={THEMES}
              labels={{
                system: <Trans>System</Trans>,
                light: <Trans>Light</Trans>,
                dark: <Trans>Dark</Trans>,
              }}
            />
          </PrefRow>
          <PrefRow label={<Trans>Language</Trans>}>
            <SegRow
              value={lang}
              onChange={onLang}
              options={LOCALES}
              labels={{
                en: <>English</>,
                pt: <>Português</>,
              }}
            />
          </PrefRow>
        </PrefCard>
      </section>

      <ScenarioPicker />

      <section className="px-4 pt-6">
        <PrefHeading>
          <Trans>Account</Trans>
        </PrefHeading>
        <PrefCard>
          <Button variant="ghost" block onClick={signOut}>
            <Trans>Sign out</Trans>
          </Button>
        </PrefCard>
      </section>

      <div className="flex-1" />
      <div
        className="pb-8 pt-6 text-center"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ink-muted)',
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}
      >
        vozcoletiva · open source
      </div>
    </div>
  );
}

function DisplayNameField() {
  const { _ } = useLingui();
  const { session } = useAuth();
  const update = useUpdateDisplayName();
  const [name, setName] = useState(session?.displayName ?? '');
  const [saved, setSaved] = useState(false);

  // Keep the input seeded as the session name resolves from the backend.
  useEffect(() => {
    setName(session?.displayName ?? '');
  }, [session?.displayName]);

  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== (session?.displayName ?? '');

  async function onSave() {
    setSaved(false);
    try {
      await update.mutateAsync(trimmed);
      setSaved(true);
    } catch {
      // error surfaced below
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Field
        label={_(t`Display name`)}
        value={name}
        maxLength={80}
        onChange={(e) => {
          setName(e.currentTarget.value);
          setSaved(false);
        }}
        error={update.isError ? _(t`Couldn't save. Please try again.`) : undefined}
        hint={saved && !dirty ? <Trans>Saved</Trans> : undefined}
      />
      <Button onClick={onSave} disabled={!dirty || update.isPending}>
        {update.isPending ? <Trans>Saving…</Trans> : <Trans>Save</Trans>}
      </Button>
    </div>
  );
}

function PrefHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="mb-2 px-1 text-[11px] font-semibold uppercase"
      style={{ color: 'var(--ink-soft)', letterSpacing: 0.06 }}
    >
      {children}
    </h3>
  );
}

function PrefCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function PrefRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="mb-2 text-xs font-medium uppercase"
        style={{ color: 'var(--ink-soft)', letterSpacing: 0.04 }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

interface SegRowProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: readonly T[];
  labels: Record<T, React.ReactNode>;
}

function SegRow<T extends string>({ value, onChange, options, labels }: SegRowProps<T>) {
  return (
    <div
      role="radiogroup"
      className="grid gap-1 rounded-xl p-1"
      style={{
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        background: 'var(--surface-2)',
        border: '0.5px solid var(--border)',
      }}
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          // biome-ignore lint/a11y/useSemanticElements: segmented-control pattern — radio styled as button so the active surface can carry the box-shadow + background
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            className="h-10 rounded-lg text-sm font-medium"
            style={{
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--ink)' : 'var(--ink-soft)',
              border: 'none',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              fontWeight: active ? 600 : 500,
            }}
          >
            {labels[opt]}
          </button>
        );
      })}
    </div>
  );
}
