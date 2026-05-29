import { Trans } from '@lingui/macro';

interface ForkingFromBannerProps {
  parentTitle: string;
}

export function ForkingFromBanner({ parentTitle }: ForkingFromBannerProps) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl p-3.5"
      style={{
        background: 'var(--accent-soft)',
        border: '1px solid color-mix(in oklab, var(--accent) 25%, transparent)',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        style={{ marginTop: 2, flexShrink: 0 }}
        aria-hidden="true"
      >
        <path
          d="M3 2v7a3 3 0 003 3h7M10 9l3 3-3 3"
          stroke="var(--accent)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="min-w-0 flex-1">
        <div
          className="text-[10.5px] font-semibold uppercase"
          style={{ color: 'var(--accent)', letterSpacing: 0.06 }}
        >
          <Trans>Proposing an alternative to</Trans>
        </div>
        <div className="mt-1 text-sm font-medium leading-tight" style={{ color: 'var(--ink)' }}>
          {parentTitle}
        </div>
        <div className="mt-1.5 text-xs" style={{ color: 'var(--ink-soft)', lineHeight: 1.45 }}>
          <Trans>
            Edit the text and parameters. The voting rule is inherited from the original.
          </Trans>
        </div>
      </div>
    </div>
  );
}
