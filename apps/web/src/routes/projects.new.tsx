import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Logo } from '../components/Logo';
import { RequireAuth } from '../components/RequireAuth';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { useCreateProject } from '../lib/projects';

export const Route = createFileRoute('/projects/new')({
  component: () => (
    <RequireAuth>
      <NewProjectPage />
    </RequireAuth>
  ),
});

function NewProjectPage() {
  const { _ } = useLingui();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const createProject = useCreateProject();

  const schema = z.object({
    name: z
      .string()
      .min(1, _(t`Please enter a project name.`))
      .max(80, _(t`Name must be 80 characters or fewer.`)),
    slug: z
      .string()
      .min(3, _(t`Slug must be 3 to 32 characters.`))
      .max(32, _(t`Slug must be 3 to 32 characters.`))
      .regex(
        /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/,
        _(t`Slug may only contain a-z, 0-9, and '-'. No leading or trailing dash.`),
      ),
  });
  type FormValues = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onNameBlur() {
    const name = watch('name');
    const slug = watch('slug');
    if (slug) return; // user already typed something
    const suggested = (name ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    if (suggested.length >= 3) setValue('slug', suggested);
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const project = await createProject.mutateAsync(values);
      navigate({ to: '/p/$slug', params: { slug: project.slug } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('slug')) {
        setFormError(_(t`This slug is already taken. Try another.`));
      } else {
        setFormError(_(t`Something went wrong. Please try again.`));
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <Logo />
      <h1 className="text-2xl font-semibold tracking-tight">
        <Trans>Create a project</Trans>
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex w-full flex-col gap-4" noValidate>
        <Field
          label={_(t`Project name`)}
          autoComplete="off"
          {...register('name', { onBlur: () => onNameBlur() })}
          error={errors.name?.message}
        />
        <Field
          label={_(t`Slug`)}
          autoComplete="off"
          {...register('slug')}
          error={errors.slug?.message}
          hint={_(t`Used in URLs: vozcoletiva.com/p/<slug>. Lowercase, dashes only.`)}
        />

        {formError && (
          <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
            {formError}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting}>
          <Trans>Create project</Trans>
        </Button>
      </form>
    </main>
  );
}
