import { Trans } from '@lingui/macro';

import type { Attachment } from '../../lib/messages/types';

interface VoiceNoteBlockProps {
  attachment: Attachment;
}

export function VoiceNoteBlock({ attachment }: VoiceNoteBlockProps) {
  if (attachment.kind !== 'voice') return null;
  const seconds = Math.round((attachment.duration_ms ?? 0) / 1000);
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return (
    <div
      className="flex items-center gap-3 rounded-full px-3 py-2"
      style={{
        background: 'var(--surface-2)',
        border: '0.5px solid var(--border)',
        maxWidth: 280,
      }}
    >
      <button
        type="button"
        aria-label="Play voice note (planned)"
        title="Voice playback is planned"
        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          border: 'none',
          cursor: 'not-allowed',
          opacity: 0.85,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
          <path d="M2 1.5v8l8-4z" fill="currentColor" />
        </svg>
      </button>
      <svg
        viewBox="0 0 120 24"
        width="120"
        height="24"
        className="flex-shrink-0"
        aria-hidden="true"
      >
        {/* Synthetic waveform */}
        {Array.from({ length: 32 }).map((_, i) => {
          // deterministic-ish heights derived from index
          const h = 4 + (((i * 31) % 16) + ((i * 7) % 5));
          return (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: synthetic, fixed-length, deterministic waveform
              key={i}
              x={i * 3.6}
              y={(24 - h) / 2}
              width="2.2"
              height={h}
              rx="1"
              fill="var(--ink-muted)"
              opacity={i < 12 ? 0.85 : 0.4}
            />
          );
        })}
      </svg>
      <span
        className="flex-shrink-0 text-xs"
        style={{
          color: 'var(--ink-soft)',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {mm}:{ss}
      </span>
      <span
        className="text-[10px] font-semibold uppercase"
        style={{
          fontFamily: 'var(--font-mono)',
          color: 'var(--accent)',
          border: '1px solid var(--accent)',
          letterSpacing: 1.2,
          padding: '1px 4px',
          borderRadius: 4,
        }}
      >
        <Trans>Planned</Trans>
      </span>
    </div>
  );
}
