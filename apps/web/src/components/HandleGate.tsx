import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useRouterState } from '@tanstack/react-router';
import { useState } from 'react';

import { useAuth } from '../lib/auth/hooks';
import { HandleError, suggestHandle, useHandleAvailability, useSetHandle } from '../lib/handle';
import { useProfile } from '../lib/profile';
import { HandleField } from './HandleField';
import { Logo } from './Logo';
import { Button } from './ui/Button';

// Auth-transition routes where the gate must never appear: the session is
// transient (sign-in/out) or the verify flow is itself mid-claim of the handle
// chosen at sign-up. Everywhere else (welcome, invites, the app) a signed-in
// user without a handle should hit the gate.
const SUPPRESS_PREFIXES = ['/sign-in', '/sign-up', '/sign-out'];

/**
 * Blocking interstitial that forces a signed-in user without a handle to pick
 * one before using the app (decision 0030). Covers legacy accounts and the rare
 * sign-up race where the chosen handle was lost. Mounted once in the root
 * layout; renders nothing unless a handle is actually required.
 */
export function HandleGate() {
  const { session } = useAuth();
  const profile = useProfile();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const suppressed = SUPPRESS_PREFIXES.some((p) => pathname.startsWith(p));
  // Only gate once we positively know there's no handle — never on a loading or
  // errored profile (which would trap the user behind a spinnerless wall).
  const needsHandle = !!session && profile.isSuccess && !profile.data.handle && !suppressed;

  if (!needsHandle) return null;
  return <HandleGateOverlay email={session?.email ?? ''} />;
}

function HandleGateOverlay({ email }: { email: string }) {
  const { _ } = useLingui();
  const [value, setValue] = useState(() => suggestHandle(email));
  const [claimError, setClaimError] = useState<string | null>(null);
  const availability = useHandleAvailability(value);
  const setHandle = useSetHandle();

  const canSubmit = availability.state === 'available' && !setHandle.isPending;

  async function onSubmit() {
    setClaimError(null);
    try {
      await setHandle.mutateAsync(value);
      // Success updates the profile cache → this gate unmounts itself.
    } catch (err) {
      if (err instanceof HandleError && err.reason === 'taken') {
        setClaimError(_(t`That handle was just taken. Try another.`));
      } else if (err instanceof HandleError && err.reason === 'invalid') {
        setClaimError(_(t`That handle isn't allowed. Try another.`));
      } else {
        setClaimError(_(t`Couldn't save your handle. Please try again.`));
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 py-12"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="handle-gate-title"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-7">
        <Logo />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 id="handle-gate-title" className="text-2xl font-semibold tracking-tight">
            <Trans>Pick your handle</Trans>
          </h1>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            <Trans>
              Your handle is how people @mention you. You can change it later if it's free.
            </Trans>
          </p>
        </div>

        <form
          className="flex w-full flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) void onSubmit();
          }}
          noValidate
        >
          <HandleField
            value={value}
            onChange={(v) => {
              setValue(v);
              setClaimError(null);
            }}
            availability={availability}
            claimError={claimError ?? undefined}
            autoFocus
          />
          <Button type="submit" disabled={!canSubmit}>
            {setHandle.isPending ? <Trans>Saving…</Trans> : <Trans>Continue</Trans>}
          </Button>
        </form>
      </div>
    </div>
  );
}
