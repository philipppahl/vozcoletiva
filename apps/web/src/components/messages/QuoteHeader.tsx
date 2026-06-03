import { Trans } from '@lingui/macro';

import type { ReplyTo } from '../../lib/messages/types';

/** The body of a quote: the text preview, or a media label for media-only. */
export function QuoteBody({ reply }: { reply: ReplyTo }) {
  if (reply.kind === 'image') return <Trans>📷 Photo</Trans>;
  if (reply.kind === 'voice') return <Trans>🎙 Voice note</Trans>;
  if (reply.kind === 'doc') return <Trans>📄 Document</Trans>;
  return <>{reply.preview || '…'}</>;
}

interface QuoteHeaderProps {
  reply: ReplyTo;
  /** Inside the viewer's own (accent) bubble → light treatment. */
  own?: boolean;
  /** Tapping jumps to the original message. */
  onJump?: () => void;
}

/**
 * The quoted-message header shown at the top of a reply bubble (decision 0031):
 * an accent bar + the quoted author and a one-line preview. Tapping scrolls to
 * the original.
 */
export function QuoteHeader({ reply, own = false, onJump }: QuoteHeaderProps) {
  const accent = own ? 'rgba(255,255,255,0.75)' : 'var(--accent)';
  const nameColor = own ? 'var(--accent-ink)' : 'var(--accent)';
  const bodyColor = own ? 'rgba(255,255,255,0.75)' : 'var(--ink-soft)';
  return (
    <button
      type="button"
      onClick={onJump}
      className="mb-1 flex w-full items-stretch gap-2 overflow-hidden rounded-md py-0.5 pr-2 text-left"
      style={{
        background: own ? 'rgba(255,255,255,0.14)' : 'var(--accent-soft)',
        border: 'none',
        cursor: onJump ? 'pointer' : 'default',
        paddingLeft: 8,
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 2.5, borderRadius: 2, background: accent, flexShrink: 0 }}
      />
      <span className="min-w-0 py-0.5">
        <span
          className="block truncate text-[12px] font-semibold leading-tight"
          style={{ color: nameColor }}
        >
          {reply.author_display_name}
        </span>
        <span className="block truncate text-[12.5px] leading-tight" style={{ color: bodyColor }}>
          <QuoteBody reply={reply} />
        </span>
      </span>
    </button>
  );
}
