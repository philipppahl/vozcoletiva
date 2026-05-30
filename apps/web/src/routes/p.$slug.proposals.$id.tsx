import { Trans } from '@lingui/macro';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { Comments } from '../components/Comments';
import { revisionTags } from '../components/forks/tree';
import { VariantTabs } from '../components/forks/VariantTabs';
import { Markdown } from '../components/Markdown';
import { RequireAuth } from '../components/RequireAuth';
import { StatusBadge } from '../components/StatusBadge';
import { ProjectShell } from '../components/shell/ProjectShell';
import { TimeRemaining } from '../components/TimeRemaining';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Segmented } from '../components/ui/Segmented';
import { SwipePager } from '../components/ui/SwipePager';
import { VoteControl } from '../components/VoteControl';
import { useAuth } from '../lib/auth/hooks';
import {
  useCastVote,
  useProposal,
  useProposalTree,
  useRetractVote,
  useWithdrawProposal,
} from '../lib/proposals';
import type { ExtendedProposal } from '../lib/proposals/types';

export const Route = createFileRoute('/p/$slug/proposals/$id')({
  component: () => (
    <RequireAuth>
      <ProposalDetailPage />
    </RequireAuth>
  ),
});

type Pane = 'proposal' | 'discussion';

function ProposalDetailPage() {
  const { slug, id } = Route.useParams();
  const navigate = useNavigate();
  const proposal = useProposal(slug, id);
  const tree = useProposalTree(slug, id);
  const castVote = useCastVote(slug, id);
  const retractVote = useRetractVote(slug, id);
  const withdraw = useWithdrawProposal(slug, id);
  const { session } = useAuth();
  const [pane, setPane] = useState<Pane>('proposal');

  const treeList = tree.data?.proposals ?? (proposal.data ? [proposal.data] : []);
  const p = proposal.data;
  const revision = p ? revisionTags(treeList)[p.id] : null;

  // Always return to the proposals list — history-back could land elsewhere
  // (came from inbox, search, a deep link, …).
  const onBack = () => navigate({ to: '/p/$slug', params: { slug } });

  const subsection = p ? (
    <Segmented<Pane>
      value={pane}
      onChange={setPane}
      options={[
        { value: 'proposal', label: <Trans>Proposal</Trans> },
        { value: 'discussion', label: <Trans>Discussion</Trans> },
      ]}
    />
  ) : undefined;

  return (
    <ProjectShell
      slug={slug}
      tab="proposals"
      pageTitle={
        p ? (
          <>
            {p.title}
            {revision && (
              <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}> {revision}</span>
            )}
          </>
        ) : (
          <Trans>Proposal</Trans>
        )
      }
      subsection={subsection}
      onBack={onBack}
    >
      {proposal.isLoading ? (
        <p className="px-4 pt-4" style={{ color: 'var(--ink-muted)' }}>
          <Trans>Loading…</Trans>
        </p>
      ) : proposal.error || !p ? (
        <p className="px-4 pt-4" style={{ color: 'var(--no)' }}>
          <Trans>Could not load this proposal.</Trans>
        </p>
      ) : (
        <SwipePager
          index={pane === 'proposal' ? 0 : 1}
          onIndexChange={(i) => setPane(i === 0 ? 'proposal' : 'discussion')}
          panes={[
            <ProposalPane
              key="proposal"
              slug={slug}
              proposal={p}
              tree={treeList}
              isAuthor={session?.userId === p.author_id}
              onVote={(c) => castVote.mutate(c)}
              onRetract={() => retractVote.mutate()}
              onWithdraw={() => withdraw.mutate()}
              voteBusy={castVote.isPending || retractVote.isPending}
              withdrawBusy={withdraw.isPending}
              onOpenVariant={(targetId) =>
                void navigate({ to: '/p/$slug/proposals/$id', params: { slug, id: targetId } })
              }
              onFork={(parentId) =>
                void navigate({
                  to: '/p/$slug/proposals/new',
                  params: { slug },
                  search: { fork: parentId },
                })
              }
            />,
            <section key="discussion" className="px-4 pt-5 pb-28">
              <Comments slug={slug} proposalId={p.id} />
            </section>,
          ]}
        />
      )}
    </ProjectShell>
  );
}

interface ProposalPaneProps {
  slug: string;
  proposal: ExtendedProposal;
  tree: ExtendedProposal[];
  isAuthor: boolean;
  onVote: (choice: string) => void;
  onRetract: () => void;
  onWithdraw: () => void;
  voteBusy: boolean;
  withdrawBusy: boolean;
  onOpenVariant: (proposalId: string) => void;
  onFork: (parentId: string) => void;
}

function ProposalPane({
  slug,
  proposal,
  tree,
  isAuthor,
  onVote,
  onRetract,
  onWithdraw,
  voteBusy,
  withdrawBusy,
  onOpenVariant,
  onFork,
}: ProposalPaneProps) {
  const p = proposal;
  const isOpen = p.status === 'voting';
  const root = tree.find((x) => x.id === p.root_id) ?? p;
  const revision = revisionTags(tree)[p.id];
  const inThread = tree.length > 1;
  const parent = p.parent_id ? tree.find((x) => x.id === p.parent_id) : null;
  const votingRule = root.voting_rule ?? 'simple_majority';

  return (
    <section className="flex flex-col gap-5 px-4 pt-4 pb-28">
      {(inThread || isOpen) && !root.is_question && (
        <div
          className="-mx-4 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          <VariantTabs
            proposal={p}
            all={tree}
            embedded
            showAdd={isOpen}
            onOpen={onOpenVariant}
            onAddAlternative={() => onFork(p.id)}
          />
        </div>
      )}
      {parent && (
        <Link
          to="/p/$slug/proposals/$id"
          params={{ slug, id: parent.id }}
          className="-mt-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase"
          style={{ color: 'var(--accent)', letterSpacing: 0.06 }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
            <path
              d="M3 2v6a3 3 0 003 3h4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <Trans>Alternative to {parent.title}</Trans>
        </Link>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={p.status as 'voting' | 'passed' | 'rejected' | 'quorum_failed' | 'withdrawn'}
          />
          {root.proposal_kind === 'document' && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Trans>Document</Trans>
              {root.document_name && (
                <span className="ml-1" style={{ opacity: 0.85 }}>
                  · {root.document_name}
                </span>
              )}
            </span>
          )}
          {isOpen && <TimeRemaining endsAt={p.ends_at} />}
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 400,
            color: 'var(--ink)',
            letterSpacing: -0.3,
            lineHeight: 1.18,
            fontVariationSettings: '"opsz" 32',
          }}
        >
          {p.title}
          {revision && (
            <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}> {revision}</span>
          )}
        </h1>
      </div>

      <article>
        <Markdown source={p.body} />
      </article>

      <Card>
        <div className="flex flex-col gap-4">
          <div
            className="text-xs font-semibold uppercase"
            style={{ color: 'var(--ink-soft)', letterSpacing: 0.06 }}
          >
            {isOpen ? <Trans>Your vote</Trans> : <Trans>Final result</Trans>}
          </div>
          <VoteControl
            tree={tree}
            viewing={p}
            myChoice={root.your_choice ?? null}
            votingRule={votingRule}
            quorum={p.quorum}
            busy={voteBusy}
            onVote={onVote}
            onRetract={onRetract}
          />
          {isOpen && (
            <button
              type="button"
              onClick={() => onFork(p.id)}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium"
              style={{
                background: 'transparent',
                border: '1px dashed var(--border-hi)',
                color: 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path
                  d="M3 2v6a3 3 0 003 3h4M9 8l2 3-3 2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <Trans>Propose an alternative</Trans>
            </button>
          )}
        </div>
      </Card>

      {isAuthor && isOpen && (
        <Button variant="danger" size="sm" onClick={onWithdraw} disabled={withdrawBusy}>
          <Trans>Withdraw proposal</Trans>
        </Button>
      )}
    </section>
  );
}
