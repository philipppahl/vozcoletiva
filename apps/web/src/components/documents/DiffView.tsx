import type { DiffRow } from './diff';

interface DiffViewProps {
  rows: DiffRow[];
}

/** Inline line-level diff. Removes are red, adds are green, context is muted. */
export function DiffView({ rows }: DiffViewProps) {
  return (
    <pre
      className="overflow-x-auto rounded-xl"
      style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        padding: '10px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        lineHeight: 1.5,
        color: 'var(--ink-soft)',
        margin: 0,
      }}
    >
      {rows.map((row, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: diff rows are positional + deterministic per render
        <Row key={`${row.kind}-${idx}-${row.text.slice(0, 6)}`} row={row} />
      ))}
    </pre>
  );
}

function Row({ row }: { row: DiffRow }) {
  const colour =
    row.kind === 'add' ? 'var(--yes)' : row.kind === 'remove' ? 'var(--no)' : 'var(--ink-muted)';
  const bg =
    row.kind === 'add'
      ? 'color-mix(in oklab, var(--yes) 12%, transparent)'
      : row.kind === 'remove'
        ? 'color-mix(in oklab, var(--no) 12%, transparent)'
        : 'transparent';
  const marker = row.kind === 'add' ? '+' : row.kind === 'remove' ? '−' : ' ';
  const beforeNo = row.kind === 'remove' || row.kind === 'context' ? String(row.beforeLine) : '';
  const afterNo = row.kind === 'add' || row.kind === 'context' ? String(row.afterLine) : '';
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 36px 18px 1fr',
        gap: 0,
        background: bg,
        padding: '0 12px',
        whiteSpace: 'pre',
      }}
    >
      <span style={{ color: 'var(--ink-muted)', textAlign: 'right', paddingRight: 8 }}>
        {beforeNo}
      </span>
      <span style={{ color: 'var(--ink-muted)', textAlign: 'right', paddingRight: 8 }}>
        {afterNo}
      </span>
      <span style={{ color: colour, fontWeight: 700 }}>{marker}</span>
      <span style={{ color: row.kind === 'context' ? 'var(--ink-soft)' : 'var(--ink)' }}>
        {row.text || ' '}
      </span>
    </div>
  );
}
