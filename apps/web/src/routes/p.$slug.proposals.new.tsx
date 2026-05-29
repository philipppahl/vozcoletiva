import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CategoryBadge } from '../components/categories/CategoryBadge';
import { CategoryPicker } from '../components/categories/CategoryPicker';
import { DiffView } from '../components/documents/DiffView';
import { diffLines } from '../components/documents/diff';
import { ForkingFromBanner } from '../components/forks/ForkingFromBanner';
import { RequireAuth } from '../components/RequireAuth';
import { TopBar } from '../components/shell/TopBar';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { VotingRulePicker } from '../components/VotingRulePicker';
import { useCategories } from '../lib/categories';
import { useDocument } from '../lib/documents';
import { useProject } from '../lib/projects';
import { useCreateProposal, useProposal } from '../lib/proposals';
import type { ProposalKind, VotingRule } from '../lib/proposals/types';

interface NewProposalSearch {
  /** When present, compose is forking from this proposal id. */
  fork?: string;
  /** When present, compose is amending this document name (kind=document). */
  amends?: string;
}

export const Route = createFileRoute('/p/$slug/proposals/new')({
  component: () => (
    <RequireAuth>
      <NewProposalPage />
    </RequireAuth>
  ),
  validateSearch: (search): NewProposalSearch => ({
    fork: typeof search.fork === 'string' ? search.fork : undefined,
    amends: typeof search.amends === 'string' ? search.amends : undefined,
  }),
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
  const search = Route.useSearch();
  const navigate = useNavigate();
  const project = useProject(slug);
  const createProposal = useCreateProposal();
  const parent = useProposal(slug, search.fork);
  const isFork = !!search.fork;
  const isAmendment = !!search.amends && !isFork;
  const amendedDoc = useDocument(slug, isAmendment ? search.amends : undefined);

  // When the parent loads and isn't open, redirect back to it. The action that
  // got us here should already have been hidden, but a stale URL can land us
  // on a closed parent.
  useEffect(() => {
    if (!isFork) return;
    if (!parent.data) return;
    if (parent.data.status !== 'voting') {
      void navigate({
        to: '/p/$slug/proposals/$id',
        params: { slug, id: parent.data.id },
      });
    }
  }, [isFork, parent.data, navigate, slug]);

  const [runtimeId, setRuntimeId] = useState<(typeof RUNTIME_PRESETS)[number]['id']>('1day');
  const [votingRule, setVotingRule] = useState<VotingRule>('simple_majority');
  const [proposalKind, setProposalKind] = useState<ProposalKind>(
    isAmendment ? 'document' : 'decision',
  );
  const [documentName, setDocumentName] = useState<string>(search.amends ?? '');
  const [bodyValue, setBodyValue] = useState<string>('');
  const [showDiff, setShowDiff] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const categories = useCategories(slug);
  // Initialise picker to the first category once loaded.
  useEffect(() => {
    if (!categoryId && categories.data?.categories[0]) {
      setCategoryId(categories.data.categories[0].id);
    }
  }, [categories.data, categoryId]);

  // When forking, inherit voting rule from the parent (server enforces it; we
  // mirror in the UI so the controls don't lie). Run only when parent arrives.
  useEffect(() => {
    if (isFork && parent.data) {
      setVotingRule(parent.data.voting_rule ?? 'simple_majority');
    }
  }, [isFork, parent.data]);

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
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Pre-fill the form when the parent loads.
  useEffect(() => {
    if (isFork && parent.data) {
      reset({
        title: parent.data.title,
        body: parent.data.body,
        quorum: parent.data.quorum != null ? String(parent.data.quorum) : '',
      });
      setBodyValue(parent.data.body);
    }
  }, [isFork, parent.data, reset]);

  // Pre-fill body from the current version when amending a document.
  useEffect(() => {
    if (isAmendment && amendedDoc.data) {
      const current = amendedDoc.data.current_version;
      reset({
        title: '',
        body: current.body,
        quorum: current.quorum != null ? String(current.quorum) : '',
      });
      setBodyValue(current.body);
      setVotingRule(current.voting_rule ?? 'simple_majority');
    }
  }, [isAmendment, amendedDoc.data, reset]);

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
        voting_rule: votingRule,
        ends_at: endsAt,
        ...(quorum !== undefined && { quorum }),
        ...(isFork && parent.data && { parent_id: parent.data.id }),
        ...(!isFork &&
          proposalKind === 'document' && {
            proposal_kind: 'document' as const,
            document_name: documentName.trim(),
          }),
        ...(!isFork && !isAmendment && categoryId && { category_id: categoryId }),
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
        title={isFork ? <Trans>Propose an alternative</Trans> : <Trans>New proposal</Trans>}
        eyebrow={project.data?.project.name ?? slug}
        onBack={() =>
          isFork && parent.data
            ? void navigate({
                to: '/p/$slug/proposals/$id',
                params: { slug, id: parent.data.id },
              })
            : void navigate({ to: '/p/$slug', params: { slug } })
        }
      />
      <section className="flex flex-col gap-6 px-4 pt-4 pb-10">
        {isFork && parent.data && <ForkingFromBanner parentTitle={parent.data.title} />}
        {isAmendment && amendedDoc.data && (
          <div
            className="rounded-xl px-3 py-2 text-xs"
            style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '0.5px solid color-mix(in oklab, var(--accent) 30%, transparent)',
            }}
          >
            <Trans>
              Proposing an amendment to {amendedDoc.data.name} (currently v
              {amendedDoc.data.version_count}).
            </Trans>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {!isFork && (
            <fieldset className="flex flex-col gap-2">
              <legend
                className="text-xs font-semibold uppercase"
                style={{ color: 'var(--ink-soft)', letterSpacing: 0.04 }}
              >
                <Trans>Kind</Trans>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(['decision', 'document'] as const).map((k) => {
                  const active = proposalKind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setProposalKind(k)}
                      aria-pressed={active}
                      className="flex flex-col items-start gap-0.5 rounded-xl p-3 text-left"
                      style={{
                        background: active ? 'var(--surface)' : 'var(--field-bg)',
                        border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {k === 'decision' ? <Trans>Decision</Trans> : <Trans>Document</Trans>}
                      </span>
                      <span
                        className="text-[11.5px]"
                        style={{ color: 'var(--ink-soft)', lineHeight: 1.4 }}
                      >
                        {k === 'decision' ? (
                          <Trans>A vote with a yes/no/alternative outcome.</Trans>
                        ) : (
                          <Trans>A new or amended canonical text.</Trans>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {!isFork && proposalKind === 'document' && !isAmendment && (
            <Field
              label={_(t`Document name`)}
              autoComplete="off"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              hint={_(t`A stable identifier for this document, e.g. "House Rules".`)}
            />
          )}

          <Field
            label={
              isFork || proposalKind === 'document' ? _(t`Title of this amendment`) : _(t`Title`)
            }
            autoComplete="off"
            {...register('title')}
            error={errors.title?.message}
          />

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" style={{ color: 'var(--ink-soft)' }}>
              {proposalKind === 'document' && isAmendment ? (
                <Trans>New body (Markdown)</Trans>
              ) : (
                <Trans>Body (Markdown)</Trans>
              )}
            </span>
            <textarea
              {...register('body')}
              onChange={(e) => {
                register('body').onChange(e);
                setBodyValue(e.target.value);
              }}
              className="min-h-[160px] rounded-xl border px-3 py-2 text-base outline-none"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--ink)',
              }}
            />
            {errors.body && (
              <span className="text-xs" style={{ color: 'var(--no)' }}>
                {errors.body.message}
              </span>
            )}
          </label>

          {isAmendment && amendedDoc.data && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowDiff((v) => !v)}
                className="self-start text-xs font-semibold underline"
                style={{
                  color: 'var(--accent)',
                  textUnderlineOffset: 3,
                  background: 'transparent',
                  border: 'none',
                  padding: 4,
                  cursor: 'pointer',
                }}
              >
                {showDiff ? <Trans>Hide diff</Trans> : <Trans>Show diff against current</Trans>}
              </button>
              {showDiff && (
                <DiffView rows={diffLines(amendedDoc.data.current_version.body, bodyValue)} />
              )}
            </div>
          )}

          {!isFork && !isAmendment && categories.data && (
            <CategoryPicker
              categories={categories.data.categories}
              selected={categoryId}
              onChange={setCategoryId}
            />
          )}
          {isAmendment && amendedDoc.data?.current_version?.category_id && (
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold uppercase"
                style={{ color: 'var(--ink-soft)', letterSpacing: 0.04 }}
              >
                <Trans>Topic</Trans>
              </span>
              <CategoryBadge slug={slug} categoryId={amendedDoc.data.current_version.category_id} />
              <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                <Trans>(inherited)</Trans>
              </span>
            </div>
          )}

          {!isFork && <VotingRulePicker value={votingRule} onChange={setVotingRule} />}
          {isFork && (
            <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              <Trans>Voting rule, quorum and runtime are inherited from the deliberation.</Trans>
            </div>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium" style={{ color: 'var(--ink-soft)' }}>
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
                    background: runtimeId === p.id ? 'var(--accent)' : 'transparent',
                    color: runtimeId === p.id ? 'var(--accent-ink)' : 'var(--ink)',
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
            <p className="text-sm" style={{ color: 'var(--no)' }}>
              {formError}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" block disabled={isSubmitting}>
            {isFork ? <Trans>Open this alternative</Trans> : <Trans>Create proposal</Trans>}
          </Button>
        </form>
      </section>
    </div>
  );
}
