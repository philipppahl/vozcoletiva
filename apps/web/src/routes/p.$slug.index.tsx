import { Trans } from '@lingui/macro';
import { createFileRoute, Link } from '@tanstack/react-router';

import { StatusBadge } from '../components/StatusBadge';
import { TallyBar } from '../components/TallyBar';
import { TimeRemaining } from '../components/TimeRemaining';
import { Button } from '../components/ui/Button';
import { useProposals } from '../lib/proposals';

export const Route = createFileRoute('/p/$slug/')({
  component: ProjectOverview,
});

function ProjectOverview() {
  const { slug } = Route.useParams();
  const proposals = useProposals(slug);

  if (proposals.isLoading) {
    return (
      <p style={{ color: 'var(--text-muted)' }}>
        <Trans>Loading…</Trans>
      </p>
    );
  }
  if (proposals.error || !proposals.data) {
    return (
      <p style={{ color: 'var(--color-danger)' }}>
        <Trans>Could not load proposals.</Trans>
      </p>
    );
  }

  const items = proposals.data.proposals;
  const open = items
    .filter((p) => p.status === 'voting')
    .sort((a, b) => Date.parse(a.ends_at) - Date.parse(b.ends_at));
  const closed = items
    .filter((p) => p.status !== 'voting')
    .sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          <Trans>Proposals</Trans>
        </h2>
        <Link to="/p/$slug/proposals/new" params={{ slug }}>
          <Button>
            <Trans>New</Trans>
          </Button>
        </Link>
      </div>

      {open.length === 0 && closed.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Trans>No proposals yet — be the first.</Trans>
        </p>
      ) : (
        <>
          {open.length > 0 && (
            <ul className="flex flex-col gap-3">
              {open.map((p) => (
                <ProposalCard key={p.id} slug={slug} p={p} />
              ))}
            </ul>
          )}
          {closed.length > 0 && (
            <>
              <h3
                className="mt-2 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trans>Recently closed</Trans>
              </h3>
              <ul className="flex flex-col gap-3">
                {closed.map((p) => (
                  <ProposalCard key={p.id} slug={slug} p={p} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}

interface ProposalLike {
  id: string;
  title: string;
  status: string;
  ends_at: string;
  tally_yes: number;
  tally_no: number;
  tally_abstain: number;
}

function ProposalCard({ slug, p }: { slug: string; p: ProposalLike }) {
  return (
    <li
      className="flex flex-col gap-3 rounded-2xl border p-4 transition-colors"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <Link to="/p/$slug/proposals/$id" params={{ slug, id: p.id }} className="flex flex-col gap-1">
        <span className="text-base font-semibold">{p.title}</span>
        <div
          className="flex flex-wrap items-center gap-2 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <StatusBadge
            status={p.status as 'voting' | 'passed' | 'rejected' | 'quorum_failed' | 'withdrawn'}
          />
          {p.status === 'voting' && <TimeRemaining endsAt={p.ends_at} />}
        </div>
      </Link>
      <TallyBar yes={p.tally_yes} no={p.tally_no} abstain={p.tally_abstain} />
    </li>
  );
}
