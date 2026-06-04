import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';

import { AuthorTag } from '../components/AuthorTag';
import { CategoryChips } from '../components/categories/CategoryChips';
import { DeliberationCard } from '../components/forks/DeliberationCard';
import { StatusBadge } from '../components/StatusBadge';
import { ProjectShell } from '../components/shell/ProjectShell';
import { TallyBar } from '../components/TallyBar';
import { TimeRemaining } from '../components/TimeRemaining';
import { Card } from '../components/ui/Card';
import { fabClassName, fabStyle, PlusIcon } from '../components/ui/Fab';
import { useCategories } from '../lib/categories';
import { useProposals } from '../lib/proposals';
import type { ExtendedProposal } from '../lib/proposals/types';

interface CategoryFilterSearch {
  category?: string;
}

export const Route = createFileRoute('/p/$slug/')({
  component: ProjectOverview,
  validateSearch: (search): CategoryFilterSearch => ({
    category: typeof search.category === 'string' ? search.category : undefined,
  }),
});

function ProjectOverview() {
  const { _ } = useLingui();
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const categories = useCategories(slug);
  const newProposalLabel = _(t`New proposal`);
  return (
    <ProjectShell
      slug={slug}
      tab="proposals"
      pageTitle={<Trans>Proposals</Trans>}
      fab={
        <Link
          to="/p/$slug/proposals/new"
          params={{ slug }}
          aria-label={newProposalLabel}
          title={newProposalLabel}
          className={fabClassName}
          style={fabStyle}
        >
          <PlusIcon />
        </Link>
      }
      subsection={
        categories.data ? (
          <CategoryChips
            categories={categories.data.categories}
            selected={search.category ?? null}
            onChange={(id) =>
              void navigate({
                to: '/p/$slug',
                params: { slug },
                search: id ? { category: id } : {},
              })
            }
          />
        ) : undefined
      }
    >
      <ProposalsList slug={slug} categoryFilter={search.category ?? null} />
    </ProjectShell>
  );
}

interface Deliberation {
  root: ExtendedProposal;
  tree: ExtendedProposal[];
  /** Earliest still-voting endsAt across the tree, for sort. */
  nextClose: number;
  /** Has any voting node in the tree. */
  isVoting: boolean;
}

function buildDeliberations(all: ExtendedProposal[]): Deliberation[] {
  const byRoot = new Map<string, ExtendedProposal[]>();
  for (const p of all) {
    const key = p.root_id;
    const bucket = byRoot.get(key);
    if (bucket) bucket.push(p);
    else byRoot.set(key, [p]);
  }
  const out: Deliberation[] = [];
  for (const [rootId, tree] of byRoot) {
    const root = tree.find((p) => p.id === rootId) ?? tree[0]!;
    const isVoting = tree.some((p) => p.status === 'voting');
    const opens = tree.filter((p) => p.status === 'voting').map((p) => Date.parse(p.ends_at));
    const nextClose = opens.length > 0 ? Math.min(...opens) : Number.MAX_SAFE_INTEGER;
    out.push({ root, tree, nextClose, isVoting });
  }
  // Voting first; within each group, soonest-closing or most-recent first.
  out.sort((a, b) => {
    if (a.isVoting !== b.isVoting) return a.isVoting ? -1 : 1;
    if (a.isVoting) return a.nextClose - b.nextClose;
    return Date.parse(b.root.ends_at) - Date.parse(a.root.ends_at);
  });
  return out;
}

function ProposalsList({ slug, categoryFilter }: { slug: string; categoryFilter: string | null }) {
  const proposals = useProposals(slug);

  if (proposals.isLoading) {
    return (
      <p className="px-4 pt-4" style={{ color: 'var(--ink-muted)' }}>
        <Trans>Loading…</Trans>
      </p>
    );
  }
  if (proposals.error || !proposals.data) {
    return (
      <p className="px-4 pt-4" style={{ color: 'var(--no)' }}>
        <Trans>Could not load proposals.</Trans>
      </p>
    );
  }

  const filtered = categoryFilter
    ? proposals.data.proposals.filter((p) => p.category_id === categoryFilter)
    : proposals.data.proposals;
  const deliberations = buildDeliberations(filtered);
  const open = deliberations.filter((d) => d.isVoting);
  const closed = deliberations.filter((d) => !d.isVoting);

  return (
    <section className="flex flex-col gap-3 px-4 pb-24 pt-4">
      {deliberations.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          <Trans>No proposals yet — be the first.</Trans>
        </p>
      ) : (
        <>
          {open.length > 0 && (
            <ul className="flex flex-col gap-3">
              {open.map((d) => (
                <li key={d.root.id}>
                  <DeliberationOrSolo slug={slug} deliberation={d} />
                </li>
              ))}
            </ul>
          )}
          {closed.length > 0 && (
            <>
              <h3
                className="mt-3 px-1 text-[11px] font-semibold uppercase"
                style={{ color: 'var(--ink-soft)', letterSpacing: 0.06 }}
              >
                <Trans>Recently closed</Trans>
              </h3>
              <ul className="flex flex-col gap-3">
                {closed.map((d) => (
                  <li key={d.root.id}>
                    <DeliberationOrSolo slug={slug} deliberation={d} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

function DeliberationOrSolo({ slug, deliberation }: { slug: string; deliberation: Deliberation }) {
  if (deliberation.tree.length === 1) {
    return <ProposalCardLink slug={slug} p={deliberation.root} />;
  }
  return <DeliberationCard root={deliberation.root} all={deliberation.tree} slug={slug} />;
}

function ProposalCardLink({ slug, p }: { slug: string; p: ExtendedProposal }) {
  return (
    <Link to="/p/$slug/proposals/$id" params={{ slug, id: p.id }} className="block">
      <Card>
        <div className="flex flex-col gap-3">
          <div
            className="flex flex-wrap items-center gap-2 text-xs"
            style={{ color: 'var(--ink-muted)' }}
          >
            <StatusBadge
              status={p.status as 'voting' | 'passed' | 'rejected' | 'quorum_failed' | 'withdrawn'}
            />
            {p.status === 'voting' && <TimeRemaining endsAt={p.ends_at} />}
          </div>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 19,
              fontWeight: 500,
              color: 'var(--ink)',
              lineHeight: 1.25,
              letterSpacing: -0.2,
              fontVariationSettings: '"opsz" 32',
            }}
          >
            {p.title}
          </h3>
          <AuthorTag slug={slug} authorId={p.author_id} />
          <TallyBar
            yes={p.tally_by_choice?.[p.id] ?? 0}
            no={(p.tally_decisive ?? 0) - (p.tally_by_choice?.[p.id] ?? 0)}
            abstain={p.tally_abstain ?? 0}
          />
        </div>
      </Card>
    </Link>
  );
}
