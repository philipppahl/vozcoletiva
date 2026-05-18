import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { mapCognitoError } from '../lib/auth/cognito';
import { useAuth } from '../lib/auth/hooks';

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
});

function SignUpPage() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.object({
    displayName: z.string().min(1, _(t`Please enter a display name.`)),
    email: z.string().email(_(t`Please enter a valid email.`)),
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
      await signUp(values);
      navigate({
        to: '/sign-up/verify',
        search: { email: values.email, displayName: values.displayName },
      });
    } catch (err) {
      const { code } = mapCognitoError(err);
      if (code === 'already_exists') {
        setFormError(_(t`An account with this email already exists.`));
      } else {
        setFormError(_(t`Something went wrong. Please try again.`));
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <Logo />
      <h1 className="text-2xl font-semibold tracking-tight">
        <Trans>Create an account</Trans>
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex w-full flex-col gap-4" noValidate>
        <Field
          label={_(t`Display name`)}
          autoComplete="name"
          {...register('displayName')}
          error={errors.displayName?.message}
        />
        <Field
          label={_(t`Email`)}
          type="email"
          autoComplete="email"
          inputMode="email"
          {...register('email')}
          error={errors.email?.message}
        />
        <Field
          label={_(t`Password`)}
          type="password"
          autoComplete="new-password"
          {...register('password')}
          error={errors.password?.message}
        />

        {formError && (
          <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
            {formError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          <Trans>Continue</Trans>
        </Button>
      </form>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Trans>Already have an account?</Trans>{' '}
        <Link to="/sign-in" className="font-semibold" style={{ color: 'var(--brand)' }}>
          <Trans>Sign in</Trans>
        </Link>
      </p>
    </main>
  );
}
