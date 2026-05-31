import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { mapCognitoError } from '../lib/auth/cognito';
import { useAuth } from '../lib/auth/hooks';
import { useUpdateDisplayName } from '../lib/profile';

interface VerifySearch {
  email: string;
  displayName: string;
}

export const Route = createFileRoute('/sign-up_/verify')({
  validateSearch: (search): VerifySearch => ({
    email: typeof search.email === 'string' ? search.email : '',
    displayName: typeof search.displayName === 'string' ? search.displayName : '',
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const { email, displayName } = Route.useSearch();
  const { confirmSignUp, signIn } = useAuth();
  const updateDisplayName = useUpdateDisplayName();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.object({
    code: z
      .string()
      .min(6, _(t`Please enter the 6-digit code.`))
      .max(6, _(t`Please enter the 6-digit code.`)),
    password: z.string().min(12, _(t`Password must be at least 12 characters.`)),
  });
  type FormValues = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await confirmSignUp(email, values.code);
      await signIn(email, values.password);
      // Bootstrap the backend profile with the chosen name (Cognito is auth-only).
      if (displayName.trim()) {
        try {
          await updateDisplayName.mutateAsync(displayName.trim());
        } catch {
          // Non-fatal: the name can be set later in Preferences. Don't block sign-in.
        }
      }
      navigate({ to: '/' });
    } catch (err) {
      const { code } = mapCognitoError(err);
      if (code === 'invalid_code') {
        setFormError(_(t`That verification code is invalid or has expired.`));
      } else if (code === 'invalid_credentials') {
        setFormError(_(t`Incorrect email or password.`));
      } else {
        setFormError(_(t`Something went wrong. Please try again.`));
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <Logo />
      <h1 className="text-2xl font-semibold tracking-tight">
        <Trans>Verification code</Trans>
      </h1>
      <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Trans>
          We sent a 6-digit code to {email}. Enter it below to finish creating your account.
        </Trans>
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex w-full flex-col gap-4" noValidate>
        <Field
          label={_(t`Verification code`)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          {...register('code')}
          error={errors.code?.message}
        />
        <Field
          label={_(t`Password`)}
          type="password"
          autoComplete="current-password"
          {...register('password')}
          error={errors.password?.message}
          hint={displayName ? <Trans>Hello, {displayName}</Trans> : undefined}
        />

        {formError && (
          <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
            {formError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          <Trans>Verify</Trans>
        </Button>
      </form>
    </main>
  );
}
