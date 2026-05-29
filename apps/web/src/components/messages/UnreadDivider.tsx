import { Trans } from '@lingui/macro';

export function UnreadDivider() {
  return (
    <div
      className="my-1 flex items-center gap-2 px-1 text-[10.5px] font-semibold uppercase"
      style={{ color: 'var(--accent)', letterSpacing: 0.08 }}
    >
      <span
        className="flex-1"
        style={{ height: 1, background: 'var(--accent)' }}
        aria-hidden="true"
      />
      <span style={{ flexShrink: 0 }}>
        <Trans>New</Trans>
      </span>
      <span
        className="flex-1"
        style={{ height: 1, background: 'var(--accent)' }}
        aria-hidden="true"
      />
    </div>
  );
}
