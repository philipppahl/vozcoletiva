import { Trans } from '@lingui/macro';
import { Link } from '@tanstack/react-router';
import type { ReactElement } from 'react';

import type { ExtendedProposal } from '../../lib/proposals/types';
import { CategoryBadge } from '../categories/CategoryBadge';
import { StatusBadge } from '../StatusBadge';
import { TimeRemaining } from '../TimeRemaining';
import { Card } from '../ui/Card';
import { treeFlat } from './tree';

interface DeliberationCardProps {
  /** The root proposal of the tree. */
  root: ExtendedProposal;
  /** All proposals in the project, used to walk the tree. */
  all: ExtendedProposal[];
  /** Project slug, used for the row links. */
  slug: string;
}

const MAX_ROWS_BEFORE_COLLAPSE = 5;

/**
 * Multi-variant card on the Proposals tab. Roots up at the top, alternatives
 * stacked beneath with per-row vote counts. Collapses to "+ N more" after
 * MAX_ROWS_BEFORE_COLLAPSE variants.
 */
export function DeliberationCard({ root, all, slug }: DeliberationCardProps) {
  const tree = treeFlat(root.id, all);
  const cardState = pickCardState(tree);
  const nextClose = nextCloseAt(tree);
  const tallyByChoice = root.tally_by_choice ?? {};
  const decisive = root.tally_decisive ?? 0;

  const visible = tree.slice(0, MAX_ROWS_BEFORE_COLLAPSE);
  const hiddenCount = Math.max(0, tree.length - visible.length);

  return (
    <Card padded={false}>
      <Link to="/p/$slug/proposals/$id" params={{ slug, id: root.id }} className="block">
        <div className="p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={cardState} />
            <CategoryBadge slug={slug} categoryId={root.category_id} />
            {root.proposal_kind === 'document' && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <Trans>Document</Trans>
              </span>
            )}
            <span className="text-xs font-medium" style={{ color: 'var(--ink-soft)' }}>
              {tree.length === 1 ? <Trans>1 variant</Trans> : <Trans>{tree.length} variants</Trans>}
            </span>
            {nextClose && (
              <span className="ml-auto text-xs" style={{ color: 'var(--ink-soft)' }}>
                <TimeRemaining endsAt={nextClose} />
              </span>
            )}
          </div>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: 20,
              lineHeight: 1.2,
              color: 'var(--ink)',
              letterSpacing: -0.25,
              textWrap: 'pretty',
              fontVariationSettings: '"opsz" 32',
              margin: 0,
            }}
          >
            {root.title}
          </h3>
        </div>
      </Link>

      <ul
        className="mx-4 mb-4 overflow-hidden rounded-2xl"
        style={{ background: 'var(--surface-2)' }}
      >
        {visible.map((node, i) => (
          <li
            key={node.id}
            style={{
              borderBottom:
                i === visible.length - 1 && hiddenCount === 0 ? 'none' : '1px solid var(--border)',
            }}
          >
            <Link
              to="/p/$slug/proposals/$id"
              params={{ slug, id: node.id }}
              className="flex items-center gap-3 px-3 py-2.5"
              style={{ color: 'var(--ink)' }}
            >
              <RowMarker
                isRoot={!node.parent_id}
                isWinner={node.status === 'passed' && tree.length > 1}
              />
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-sm font-medium"
                  style={{ color: 'var(--ink)', lineHeight: 1.3 }}
                >
                  {node.title}
                </div>
                {node.status !== 'voting' && (
                  <div className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                    {statusLabel(node.status)}
                  </div>
                )}
              </div>
              <VoteShare
                count={tallyByChoice[node.id] ?? 0}
                decisive={decisive}
                winning={node.status === 'passed' && tree.length > 1}
              />
            </Link>
          </li>
        ))}
        {hiddenCount > 0 && (
          <li>
            <Link
              to="/p/$slug/proposals/$id"
              params={{ slug, id: root.id }}
              className="block px-3 py-2.5 text-xs font-semibold"
              style={{ color: 'var(--accent)' }}
            >
              <Trans>+ {hiddenCount} more</Trans>
            </Link>
          </li>
        )}
      </ul>
    </Card>
  );
}

function RowMarker({ isRoot, isWinner }: { isRoot: boolean; isWinner: boolean }) {
  if (isWinner) {
    return (
      <span
        aria-hidden="true"
        style={{
          width: 22,
          flexShrink: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          textAlign: 'center',
          color: 'var(--yes)',
          fontWeight: 700,
        }}
      >
        ✓
      </span>
    );
  }
  if (isRoot) {
    return (
      <span
        aria-hidden="true"
        style={{ width: 22, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: 'var(--accent)',
          }}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        width: 22,
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        textAlign: 'center',
        color: 'var(--ink-soft)',
      }}
    >
      ↳
    </span>
  );
}

function VoteShare({
  count,
  decisive,
  winning,
}: {
  count: number;
  decisive: number;
  winning: boolean;
}) {
  const pct = decisive === 0 ? 0 : Math.round((count / decisive) * 100);
  return (
    <div className="flex w-[64px] flex-shrink-0 flex-col items-end gap-1">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--surface)' }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: winning ? 'var(--yes)' : 'var(--accent)',
            opacity: winning ? 1 : 0.7,
          }}
        />
      </div>
      <div
        className="text-[11px]"
        style={{ color: 'var(--ink-muted)', fontVariantNumeric: 'tabular-nums' }}
      >
        <span style={{ fontWeight: 600, color: 'var(--ink-soft)' }}>{count}</span>
        <span style={{ color: 'var(--border)' }}> · {pct}%</span>
      </div>
    </div>
  );
}

function pickCardState(tree: ExtendedProposal[]): ExtendedProposal['status'] {
  if (tree.some((p) => p.status === 'voting')) return 'voting';
  if (tree.some((p) => p.status === 'passed')) return 'passed';
  if (tree.some((p) => p.status === 'rejected')) return 'rejected';
  if (tree.some((p) => p.status === 'quorum_failed')) return 'quorum_failed';
  return 'withdrawn';
}

function nextCloseAt(tree: ExtendedProposal[]): string | null {
  const opens = tree.filter((p) => p.status === 'voting').map((p) => p.ends_at);
  if (opens.length === 0) return null;
  return opens.sort()[0] ?? null;
}

function statusLabel(status: ExtendedProposal['status']): ReactElement {
  switch (status) {
    case 'passed':
      return <Trans>passed</Trans>;
    case 'rejected':
      return <Trans>rejected</Trans>;
    case 'quorum_failed':
      return <Trans>quorum failed</Trans>;
    case 'withdrawn':
      return <Trans>withdrawn</Trans>;
    default:
      return <Trans>voting</Trans>;
  }
}
