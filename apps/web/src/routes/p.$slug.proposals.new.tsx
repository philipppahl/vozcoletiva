import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { RequireAuth } from '../components/RequireAuth';
import { TopBar } from '../components/shell/TopBar';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { useProject } from '../lib/projects';
import { useCreateProposal } from '../lib/proposals';

export const Route = createFileRoute('/p/$slug/proposals/new')({
  component: () => (
    <RequireAuth>
      <NewProposalPage />
    </RequireAuth>
  ),
});

const RUNTIME_PRESETS = [
  { id: '2min', mins: 2 },
  { id: '1hour', mins: 60 },
  { id: '1day', mins: 60 * 24 },
  { id: '1week', mins: 60 * 24 * 7 },
] as const;

function NewProposalPage() {
  const { _ } = useLingui();
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const project = useProject(slug);
  const createProposal = useCreateProposal();

  const [runtimeId, setRuntimeId] = useState<(typeof RUNTIME_PRESETS)[number]['id']>('1day');
  const [votingMode, setVotingMode] = useState<'simple_majority' | 'qualified_two_thirds'>(
    'simple_majority',
  );
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.object({
    title: z.string().min(1).max(200, _(t`Title must be 1-200 characters.`)),
    body: z.string().min(1).max(50_000),
    quorum: z
      .string()
      .optional()
      .refine(
        (v) => v === undefined || v === '' || Number.isInteger(Number(v)),
        _(t`Quorum must be a whole number.`),
      ),
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
      const preset = RUNTIME_PRESETS.find((p) => p.id === runtimeId) ?? RUNTIME_PRESETS[2];
      const endsAt = new Date(Date.now() + preset.mins * 60_000).toISOString();
      const quorum = values.quorum && values.quorum !== '' ? Number(values.quorum) : undefined;
      const proposal = await createProposal.mutateAsync({
        slug,
        title: values.title,
        body: values.body,
        voting_mode: votingMode,
        ends_at: endsAt,
        ...(quorum !== undefined && { quorum }),
      });
      navigate({
        to: '/p/$slug/proposals/$id',
        params: { slug, id: proposal.id },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setFormError(msg || _(t`Something went wrong. Please try again.`));
    }
  }

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <TopBar
        title={<Trans>New proposal</Trans>}
        eyebrow={project.data?.project.name ?? slug}
        onBack={() => void navigate({ to: '/p/$slug', params: { slug } })}
      />
      <section className="flex flex-col gap-6 px-4 pt-4 pb-10">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field
            label={_(t`Title`)}
            autoComplete="off"
            {...register('title')}
            error={errors.title?.message}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              <Trans>Body (Markdown)</Trans>
            </span>
            <textarea
              {...register('body')}
              className="min-h-[160px] rounded-xl border px-3 py-2 text-base outline-none"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            />
            {errors.body && (
              <span className="text-xs" style={{ color: 'var(--color-danger)' }}>
                {errors.body.message}
              </span>
            )}
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              <Trans>Voting rule</Trans>
            </legend>
            <div
              className="flex items-center gap-1 self-start rounded-full border p-1"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              {(['simple_majority', 'qualified_two_thirds'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setVotingMode(m)}
                  aria-pressed={votingMode === m}
                  className="min-h-[40px] rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    background: votingMode === m ? 'var(--brand)' : 'transparent',
                    color: votingMode === m ? '#ffffff' : 'var(--text-primary)',
                  }}
                >
                  {m === 'simple_majority' ? _(t`Simple majority`) : _(t`Two-thirds`)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              <Trans>Runtime</Trans>
            </legend>
            <div
              className="flex flex-wrap items-center gap-1 self-start rounded-full border p-1"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              {RUNTIME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setRuntimeId(p.id)}
                  aria-pressed={runtimeId === p.id}
                  className="min-h-[40px] rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    background: runtimeId === p.id ? 'var(--brand)' : 'transparent',
                    color: runtimeId === p.id ? '#ffffff' : 'var(--text-primary)',
                  }}
                >
                  {p.id === '2min'
                    ? _(t`2 min (testing)`)
                    : p.id === '1hour'
                      ? _(t`1 hour`)
                      : p.id === '1day'
                        ? _(t`1 day`)
                        : _(t`1 week`)}
                </button>
              ))}
            </div>
          </fieldset>

          <Field
            label={_(t`Quorum (optional)`)}
            type="number"
            min={1}
            placeholder={_(t`e.g. 3`)}
            {...register('quorum')}
            error={errors.quorum?.message}
            hint={_(t`Minimum number of voters required for the result to count.`)}
          />

          {formError && (
            <p className="text-sm" style={{ color: 'var(--color-danger)' }}>
              {formError}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" block disabled={isSubmitting}>
            <Trans>Create proposal</Trans>
          </Button>
        </form>
      </section>
    </div>
  );
}
