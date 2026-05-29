import { Trans } from '@lingui/macro';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import { Logo } from '../components/Logo';
import { RequireAuth } from '../components/RequireAuth';
import { Button } from '../components/ui/Button';
import { completeOnboarding } from '../lib/onboarding';

export const Route = createFileRoute('/welcome')({
  component: () => (
    <RequireAuth>
      <WelcomePage />
    </RequireAuth>
  ),
});

function WelcomePage() {
  const navigate = useNavigate();

  function onSkip() {
    completeOnboarding();
    void navigate({ to: '/' });
  }

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="flex flex-col items-center pt-8 text-center">
        <Logo size={56} />
        <h1
          className="mt-5"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            fontWeight: 400,
            letterSpacing: -0.3,
            color: 'var(--ink)',
            lineHeight: 1.1,
            fontVariationSettings: '"opsz" 36',
            textWrap: 'pretty',
          }}
        >
          <Trans>Welcome to vozcoletiva</Trans>
        </h1>
        <p
          className="mt-3 text-base"
          style={{
            color: 'var(--ink-soft)',
            lineHeight: 1.5,
            maxWidth: '32ch',
            textWrap: 'pretty',
          }}
        >
          <Trans>Collective decisions, kept in the open.</Trans>
        </p>
      </div>

      <section className="mt-10 flex flex-col gap-5">
        <ValueProp
          icon={decideIcon}
          title={<Trans>Decide together</Trans>}
          body={<Trans>Propose, discuss, and vote with the people who share the decision.</Trans>}
        />
        <ValueProp
          icon={accountableIcon}
          title={<Trans>Stay accountable</Trans>}
          body={<Trans>Every vote and amendment is recorded. The history is the record.</Trans>}
        />
        <ValueProp
          icon={calmIcon}
          title={<Trans>No noise, no streaks</Trans>}
          body={<Trans>Calm-by-design. Notifications only when it's worth your attention.</Trans>}
        />
      </section>

      <div className="flex flex-1" />

      <div className="mt-10 flex flex-col items-stretch gap-3 pt-2">
        <Link to="/projects/new" onClick={completeOnboarding}>
          <Button variant="primary" size="lg" block>
            <Trans>Create a project</Trans>
          </Button>
        </Link>
        <Link to="/join" onClick={completeOnboarding}>
          <Button variant="secondary" size="lg" block>
            <Trans>Join with code</Trans>
          </Button>
        </Link>
        <button
          type="button"
          onClick={onSkip}
          className="self-center text-sm font-semibold"
          style={{
            color: 'var(--ink-muted)',
            background: 'transparent',
            border: 'none',
            padding: 8,
            cursor: 'pointer',
          }}
        >
          <Trans>Skip for now</Trans>
        </button>
      </div>
    </main>
  );
}

interface ValuePropProps {
  icon: ReactElement;
  title: ReactElement;
  body: ReactElement;
}

function ValueProp({ icon, title, body }: ValuePropProps) {
  return (
    <article className="flex items-start gap-4">
      <span
        aria-hidden="true"
        className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
        style={{
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          border: '0.5px solid color-mix(in oklab, var(--accent) 25%, transparent)',
        }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            fontWeight: 500,
            color: 'var(--ink)',
            lineHeight: 1.25,
            letterSpacing: -0.15,
            fontVariationSettings: '"opsz" 24',
          }}
        >
          {title}
        </h3>
        <p
          className="mt-1 text-sm"
          style={{
            color: 'var(--ink-soft)',
            lineHeight: 1.45,
            textWrap: 'pretty',
          }}
        >
          {body}
        </p>
      </div>
    </article>
  );
}

const decideIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <circle cx="6" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="14" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M2 16c.6-2.4 2.2-3.4 4-3.4s3.4 1 4 3.4M10 16c.6-2.4 2.2-3.4 4-3.4s3.4 1 4 3.4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

const accountableIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <rect x="3.5" y="3" width="13" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M6.5 8h7M6.5 11h7M6.5 14h4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

const calmIcon = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M10 3v2M10 15v2M3 10h2M15 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);
