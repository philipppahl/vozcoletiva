import { Trans } from '@lingui/macro';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { Comments } from '../components/Comments';
import { Markdown } from '../components/Markdown';
import { RequireAuth } from '../components/RequireAuth';
import { StatusBadge } from '../components/StatusBadge';
import { TopBar } from '../components/shell/TopBar';
import { TallyBar } from '../components/TallyBar';
import { TimeRemaining } from '../components/TimeRemaining';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useAuth } from '../lib/auth/hooks';
import { useProject } from '../lib/projects';
import { useCastVote, useProposal, useRetractVote, useWithdrawProposal } from '../lib/proposals';

export const Route = createFileRoute('/p/$slug/proposals/$id')({
  component: () => (
    <RequireAuth>
      <ProposalDetailPage />
    </RequireAuth>
  ),
});

function ProposalDetailPage() {
  const { slug, id } = Route.useParams();
  const navigate = useNavigate();
  const project = useProject(slug);
  const proposal = useProposal(slug, id);
  const castVote = useCastVote(slug, id);
  const retractVote = useRetractVote(slug, id);
  const withdraw = useWithdrawProposal(slug, id);
  const { session } = useAuth();

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <TopBar
        title={proposal.data?.title ?? <Trans>Proposal</Trans>}
        eyebrow={project.data?.project.name ?? slug}
        onBack={() => void navigate({ to: '/p/$slug', params: { slug } })}
      />

      {proposal.isLoading ? (
        <p className="px-4 pt-4" style={{ color: 'var(--ink-muted)' }}>
          <Trans>Loading…</Trans>
        </p>
      ) : proposal.error || !proposal.data ? (
        <p className="px-4 pt-4" style={{ color: 'var(--no)' }}>
          <Trans>Could not load this proposal.</Trans>
        </p>
      ) : (
        <Body
          slug={slug}
          proposal={proposal.data}
          isAuthor={session?.userId === proposal.data.author_id}
          onVote={(c) => castVote.mutate(c)}
          onRetract={() => retractVote.mutate()}
          onWithdraw={() => withdraw.mutate()}
          voteBusy={castVote.isPending || retractVote.isPending}
          withdrawBusy={withdraw.isPending}
        />
      )}
    </div>
  );
}

interface ProposalShape {
  id: string;
  title: string;
  body: string;
  status: string;
  ends_at: string;
  voting_mode: string;
  quorum?: number | null;
  tally_yes: number;
  tally_no: number;
  tally_abstain: number;
  your_choice?: 'yes' | 'no' | 'abstain';
  author_id: string;
}

interface BodyProps {
  slug: string;
  proposal: ProposalShape;
  isAuthor: boolean;
  onVote: (choice: 'yes' | 'no' | 'abstain') => void;
  onRetract: () => void;
  onWithdraw: () => void;
  voteBusy: boolean;
  withdrawBusy: boolean;
}

function Body({
  slug,
  proposal,
  isAuthor,
  onVote,
  onRetract,
  onWithdraw,
  voteBusy,
  withdrawBusy,
}: BodyProps) {
  const p = proposal;
  const isOpen = p.status === 'voting';

  return (
    <section className="flex flex-col gap-5 px-4 pt-5 pb-10">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={p.status as 'voting' | 'passed' | 'rejected' | 'quorum_failed' | 'withdrawn'}
          />
          {isOpen && <TimeRemaining endsAt={p.ends_at} />}
          <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            ·{' '}
            {p.voting_mode === 'simple_majority' ? (
              <Trans>Simple majority</Trans>
            ) : (
              <Trans>Two-thirds</Trans>
            )}
          </span>
          {p.quorum != null && (
            <span className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              · <Trans>Quorum {p.quorum}</Trans>
            </span>
          )}
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
        </h1>
      </div>

      <Card>
        <div className="flex flex-col gap-4">
          <div
            className="text-xs font-semibold uppercase"
            style={{ color: 'var(--ink-soft)', letterSpacing: 0.06 }}
          >
            {isOpen ? <Trans>Running tally</Trans> : <Trans>Final result</Trans>}
          </div>
          <TallyBar yes={p.tally_yes} no={p.tally_no} abstain={p.tally_abstain} />
          {isOpen && (
            <>
              <div className="h-px" style={{ background: 'var(--border)' }} />
              <div>
                <div
                  className="mb-2 text-xs font-semibold uppercase"
                  style={{ color: 'var(--ink-soft)', letterSpacing: 0.06 }}
                >
                  <Trans>Your vote</Trans>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={p.your_choice === 'yes' ? 'yes' : 'secondary'}
                    size="lg"
                    onClick={() => onVote('yes')}
                    disabled={voteBusy}
                  >
                    <Trans>Yes</Trans>
                  </Button>
                  <Button
                    variant={p.your_choice === 'no' ? 'no' : 'secondary'}
                    size="lg"
                    onClick={() => onVote('no')}
                    disabled={voteBusy}
                  >
                    <Trans>No</Trans>
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onVote('abstain')}
                    disabled={voteBusy}
                    className="text-sm font-medium underline"
                    style={{
                      color: p.your_choice === 'abstain' ? 'var(--ink)' : 'var(--ink-soft)',
                      textUnderlineOffset: 4,
                      textDecorationColor:
                        p.your_choice === 'abstain' ? 'var(--ink)' : 'var(--border)',
                      background: 'transparent',
                      border: 'none',
                      padding: 6,
                      cursor: 'pointer',
                    }}
                  >
                    {p.your_choice === 'abstain' ? '✓ ' : ''}
                    <Trans>Abstain</Trans>
                  </button>
                  {p.your_choice && (
                    <button
                      type="button"
                      onClick={onRetract}
                      disabled={voteBusy}
                      className="text-xs underline"
                      style={{
                        color: 'var(--ink-muted)',
                        textUnderlineOffset: 3,
                        background: 'transparent',
                        border: 'none',
                        padding: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <Trans>Retract</Trans>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      <article>
        <Markdown source={p.body} />
      </article>

      {isAuthor && isOpen && (
        <Button variant="danger" size="sm" onClick={onWithdraw} disabled={withdrawBusy}>
          <Trans>Withdraw proposal</Trans>
        </Button>
      )}

      <Comments slug={slug} proposalId={p.id} />
    </section>
  );
}
