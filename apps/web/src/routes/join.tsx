import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { Logo } from '../components/Logo';
import { RequireAuth } from '../components/RequireAuth';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { useAcceptInviteByCode } from '../lib/invites';

export const Route = createFileRoute('/join')({
  component: () => (
    <RequireAuth>
      <JoinByCode />
    </RequireAuth>
  ),
});

function JoinByCode() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const acceptByCode = useAcceptInviteByCode();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalised = code.trim().toUpperCase();
    if (normalised.length !== 8) {
      setError(_(t`Code must be exactly 8 characters.`));
      return;
    }
    try {
      const result = await acceptByCode.mutateAsync(normalised);
      navigate({ to: '/p/$slug', params: { slug: result.project.slug } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('not found')) {
        setError(_(t`We couldn't find an invite for that code.`));
      } else if (msg.toLowerCase().includes('conflict')) {
        setError(_(t`That invite is no longer valid.`));
      } else {
        setError(_(t`Something went wrong. Please try again.`));
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
      <Logo />
      <h1 className="text-2xl font-semibold tracking-tight">
        <Trans>Join with a code</Trans>
      </h1>
      <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Trans>Enter the 8-character invite code someone shared with you.</Trans>
      </p>

      <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
        <Field
          label={_(t`Code`)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={8}
          error={error ?? undefined}
        />
        <Button type="submit" disabled={acceptByCode.isPending}>
          <Trans>Join</Trans>
        </Button>
      </form>
    </main>
  );
}
