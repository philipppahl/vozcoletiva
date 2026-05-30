import { Trans } from '@lingui/macro';
import { forwardRef, useEffect, useRef } from 'react';

import type { ExtendedProposal } from '../../lib/proposals/types';
import { revisionTags, rowPrefix, type TreeRow, treeRows } from './tree';

interface VariantTabsProps {
  proposal: ExtendedProposal;
  all: ExtendedProposal[];
  /** When true, shows the trailing "+ Add an alternative" row. */
  showAdd?: boolean;
  /** When true, drop the standalone sticky positioning — the component is
   *  rendered inside the (already sticky) header subsection. */
  embedded?: boolean;
  onOpen: (proposalId: string) => void;
  onAddAlternative?: () => void;
}

const MAX_VISIBLE_ROWS = 5;
const ROW_HEIGHT = 30; // approximate; matches the styled row height

/**
 * Sticky tree-with-branches under the project header on the proposal detail
 * page. Each row is a button that opens that variant. Connectors are pure
 * monospace box-drawing characters.
 */
export function VariantTabs({
  proposal,
  all,
  showAdd = true,
  embedded = false,
  onOpen,
  onAddAlternative,
}: VariantTabsProps) {
  const root = all.find((p) => p.id === proposal.root_id) ?? proposal;
  const tallyByChoice = root.tally_by_choice ?? {};
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const rows = treeRows(proposal.root_id, all);
  const revs = revisionTags(rows.map((r) => r.proposal));

  useEffect(() => {
    const c = containerRef.current;
    const a = activeRef.current;
    if (!c || !a) return;
    const cr = c.getBoundingClientRect();
    const ar = a.getBoundingClientRect();
    if (ar.top < cr.top || ar.bottom > cr.bottom) {
      c.scrollTo({ top: c.scrollTop + (ar.top - cr.top) - 4, behavior: 'smooth' });
    }
  }, [proposal.id]);

  if (rows.length <= 1 && !showAdd) return null;

  const collapses = rows.length > MAX_VISIBLE_ROWS;

  return (
    <div
      className="flex-shrink-0"
      style={
        embedded
          ? { background: 'transparent' }
          : {
              position: 'sticky',
              top: 62, // TopBar height
              zIndex: 8,
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--border)',
            }
      }
    >
      <div
        className="flex items-baseline justify-between px-4 pb-1 pt-2.5"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.08,
          color: 'var(--ink-muted)',
          textTransform: 'uppercase',
        }}
      >
        <span>
          <Trans>Alternatives</Trans>
        </span>
        <span style={{ fontWeight: 500 }}>
          {rows.length === 1 ? <Trans>1 variant</Trans> : <Trans>{rows.length} variants</Trans>}
        </span>
      </div>
      <div
        ref={containerRef}
        style={{
          padding: '2px 4px 6px',
          maxHeight: collapses ? MAX_VISIBLE_ROWS * ROW_HEIGHT + 12 : undefined,
          overflowY: collapses ? 'auto' : 'visible',
        }}
      >
        {rows.map((row) => (
          <Row
            key={row.proposal.id}
            row={row}
            voteCount={tallyByChoice[row.proposal.id] ?? 0}
            revision={revs[row.proposal.id] ?? null}
            isCurrent={row.proposal.id === proposal.id}
            ref={row.proposal.id === proposal.id ? activeRef : undefined}
            onClick={() => onOpen(row.proposal.id)}
          />
        ))}
        {showAdd && onAddAlternative && (
          <button
            type="button"
            onClick={onAddAlternative}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink-soft)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12.5,
              fontWeight: 500,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--border-hi)',
                letterSpacing: 1,
              }}
            >
              +
            </span>
            <Trans>Add an alternative</Trans>
          </button>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  row: TreeRow;
  voteCount: number;
  revision: string | null;
  isCurrent: boolean;
  onClick: () => void;
}

const Row = forwardRef<HTMLButtonElement, RowProps>(function Row(
  { row, voteCount, revision, isCurrent, onClick },
  ref,
) {
  const p = row.proposal;
  const stateColor =
    p.status === 'voting'
      ? 'var(--accent)'
      : p.status === 'passed'
        ? 'var(--yes)'
        : p.status === 'rejected' || p.status === 'quorum_failed'
          ? 'var(--no)'
          : 'var(--ink-muted)';

  const prefix = rowPrefix(row);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={isCurrent ? 'page' : undefined}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left"
      style={{
        background: isCurrent ? 'var(--surface)' : 'transparent',
        border: `1px solid ${isCurrent ? 'var(--border-hi)' : 'transparent'}`,
        boxShadow: isCurrent ? 'var(--shadow-sm)' : 'none',
        fontFamily: 'var(--font-sans)',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: 'var(--border-hi)',
          whiteSpace: 'pre',
          flexShrink: 0,
          lineHeight: 1,
          fontWeight: 400,
          letterSpacing: 0.5,
        }}
      >
        {prefix}
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: isCurrent ? stateColor : 'transparent',
          border: `1.5px solid ${stateColor}`,
          flexShrink: 0,
        }}
      />
      <span
        className="flex-1 truncate"
        style={{
          fontSize: 13,
          fontWeight: isCurrent ? 600 : 500,
          color: 'var(--ink)',
          lineHeight: 1.3,
          minWidth: 0,
        }}
      >
        {p.title}
        {revision && (
          <span style={{ color: 'var(--ink-muted)', fontWeight: 500 }}> {revision}</span>
        )}
      </span>
      {voteCount > 0 && (
        <span
          className="flex-shrink-0 text-[11px]"
          style={{
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--ink-muted)',
            fontFamily: 'var(--font-sans)',
            fontWeight: 600,
          }}
        >
          {voteCount}
        </span>
      )}
    </button>
  );
});
