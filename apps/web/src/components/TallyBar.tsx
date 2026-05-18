import { Trans } from '@lingui/macro';

interface TallyBarProps {
  yes: number;
  no: number;
  abstain: number;
}

export function TallyBar({ yes, no, abstain }: TallyBarProps) {
  const total = Math.max(yes + no + abstain, 1);
  const yesPct = (yes / total) * 100;
  const noPct = (no / total) * 100;
  const abstainPct = (abstain / total) * 100;
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex h-3 overflow-hidden rounded-full"
        style={{ background: 'var(--surface-raised)' }}
        role="img"
        aria-label={`yes ${yes}, no ${no}, abstain ${abstain}`}
      >
        <div style={{ width: `${yesPct}%`, background: 'var(--color-success)' }} />
        <div style={{ width: `${noPct}%`, background: 'var(--color-danger)' }} />
        <div style={{ width: `${abstainPct}%`, background: 'var(--color-neutral-400)' }} />
      </div>
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span>
          <Trans>Yes</Trans> · {yes}
        </span>
        <span>
          <Trans>No</Trans> · {no}
        </span>
        <span>
          <Trans>Abstain</Trans> · {abstain}
        </span>
      </div>
    </div>
  );
}
