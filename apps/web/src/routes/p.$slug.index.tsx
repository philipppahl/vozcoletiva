import { Trans } from '@lingui/macro';
import { createFileRoute, Link } from '@tanstack/react-router';
import { StatusBadge } from '../components/StatusBadge';
import { ProjectShell } from '../components/shell/ProjectShell';
import { TallyBar } from '../components/TallyBar';
import { TimeRemaining } from '../components/TimeRemaining';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useProposals } from '../lib/proposals';

export const Route = createFileRoute('/p/$slug/')({
  component: ProjectOverview,
});

function ProjectOverview() {
  const { slug } = Route.useParams();
  return (
    <ProjectShell slug={slug} tab="proposals" pageTitle={<Trans>Proposals</Trans>}>
      <ProposalsList slug={slug} />
    </ProjectShell>
  );
}

function ProposalsList({ slug }: { slug: string }) {
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

  const items = proposals.data.proposals;
  const open = items
    .filter((p) => p.status === 'voting')
    .sort((a, b) => Date.parse(a.ends_at) - Date.parse(b.ends_at));
  const closed = items
    .filter((p) => p.status !== 'voting')
    .sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at));

  return (
    <section className="flex flex-col gap-3 px-4 pb-24 pt-4">
      {open.length === 0 && closed.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          <Trans>No proposals yet — be the first.</Trans>
        </p>
      ) : (
        <>
          {open.length > 0 && (
            <ul className="flex flex-col gap-3">
              {open.map((p) => (
                <li key={p.id}>
                  <ProposalCardLink slug={slug} p={p} />
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
                {closed.map((p) => (
                  <li key={p.id}>
                    <ProposalCardLink slug={slug} p={p} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <Link
        to="/p/$slug/proposals/new"
        params={{ slug }}
        className="sticky bottom-24 ml-auto inline-flex"
        style={{ marginTop: 8 }}
      >
        <Button variant="primary" size="lg">
          <Trans>New proposal</Trans>
        </Button>
      </Link>
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

function ProposalCardLink({ slug, p }: { slug: string; p: ProposalLike }) {
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
          <TallyBar yes={p.tally_yes} no={p.tally_no} abstain={p.tally_abstain} />
        </div>
      </Card>
    </Link>
  );
}
