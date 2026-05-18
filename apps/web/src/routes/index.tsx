import { createFileRoute } from '@tanstack/react-router';
import type { Theme } from '@vozcoletiva/shared';
import { useThemeStore } from '../lib/theme';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo />
        <h1 className="text-3xl font-semibold tracking-tight">vozcoletiva</h1>
        <p className="text-base text-[color:var(--text-secondary)]">
          Structured collective decision-making. Foundation slice — features land one plan-feature
          cycle at a time.
        </p>
      </div>

      <ThemeToggle current={theme} onChange={setTheme} />
    </main>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="vozcoletiva">
      <title>vozcoletiva</title>
      <rect width="64" height="64" rx="14" ry="14" fill="var(--brand)" />
      <path
        d="M 16 20 L 30 46 L 48 14"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="48" cy="14" r="4" fill="var(--accent)" />
    </svg>
  );
}

const THEMES: readonly Theme[] = ['system', 'light', 'dark'] as const;

function ThemeToggle({ current, onChange }: { current: Theme; onChange: (next: Theme) => void }) {
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
          onClick={() => onChange(t)}
          aria-pressed={current === t}
          className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background: current === t ? 'var(--brand)' : 'transparent',
            color: current === t ? '#ffffff' : 'var(--text-primary)',
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
