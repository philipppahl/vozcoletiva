import { Trans } from '@lingui/macro';
import { createFileRoute, Link } from '@tanstack/react-router';

import { Comments } from '../components/Comments';
import { Markdown } from '../components/Markdown';
import { RequireAuth } from '../components/RequireAuth';
import { StatusBadge } from '../components/StatusBadge';
import { TallyBar } from '../components/TallyBar';
import { TimeRemaining } from '../components/TimeRemaining';
import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/auth/hooks';
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
  const proposal = useProposal(slug, id);
  const castVote = useCastVote(slug, id);
  const retractVote = useRetractVote(slug, id);
  const withdraw = useWithdrawProposal(slug, id);
  const { session } = useAuth();

  if (proposal.isLoading) {
    return (
      <p style={{ color: 'var(--text-muted)' }}>
        <Trans>Loading…</Trans>
      </p>
    );
  }
  if (proposal.error || !proposal.data) {
    return (
      <p style={{ color: 'var(--color-danger)' }}>
        <Trans>Could not load this proposal.</Trans>
      </p>
    );
  }

  const p = proposal.data;
  const isAuthor = session?.userId === p.author_id;
  const isOpen = p.status === 'voting';

  return (
    <section className="flex flex-col gap-6">
      <Link
        to="/p/$slug"
        params={{ slug }}
        className="text-xs font-semibold"
        style={{ color: 'var(--brand)' }}
      >
        <Trans>← All proposals</Trans>
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={p.status as 'voting' | 'passed' | 'rejected' | 'quorum_failed' | 'withdrawn'}
          />
          {isOpen && <TimeRemaining endsAt={p.ends_at} />}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ·{' '}
            {p.voting_mode === 'simple_majority' ? (
              <Trans>Simple majority</Trans>
            ) : (
              <Trans>Two-thirds</Trans>
            )}
          </span>
          {p.quorum && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              · <Trans>Quorum {p.quorum}</Trans>
            </span>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>
      </header>

      <TallyBar yes={p.tally_yes} no={p.tally_no} abstain={p.tally_abstain} />

      {isOpen ? (
        <div
          className="flex flex-col gap-3 rounded-2xl border p-4"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Trans>Your vote</Trans>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {(['yes', 'no', 'abstain'] as const).map((choice) => {
              const active = p.your_choice === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => castVote.mutate(choice)}
                  disabled={castVote.isPending}
                  className="min-h-[44px] rounded-full px-4 py-2 text-sm font-semibold transition"
                  style={{
                    background: active
                      ? choice === 'yes'
                        ? 'var(--color-success)'
                        : choice === 'no'
                          ? 'var(--color-danger)'
                          : 'var(--color-neutral-500)'
                      : 'transparent',
                    color: active ? '#ffffff' : 'var(--text-primary)',
                    border: active ? 'none' : '1px solid var(--border)',
                  }}
                  aria-pressed={active}
                >
                  {choice === 'yes' ? (
                    <Trans>Yes</Trans>
                  ) : choice === 'no' ? (
                    <Trans>No</Trans>
                  ) : (
                    <Trans>Abstain</Trans>
                  )}
                </button>
              );
            })}
            {p.your_choice && (
              <Button
                variant="secondary"
                onClick={() => retractVote.mutate()}
                disabled={retractVote.isPending}
              >
                <Trans>Retract</Trans>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          <Trans>Voting is closed.</Trans>
        </p>
      )}

      <article>
        <Markdown source={p.body} />
      </article>

      {isAuthor && isOpen && (
        <Button variant="secondary" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>
          <Trans>Withdraw proposal</Trans>
        </Button>
      )}

      <Comments slug={slug} proposalId={id} />
    </section>
  );
}
