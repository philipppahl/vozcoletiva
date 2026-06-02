import { useRef, useState } from 'react';

import type { Attachment } from '../../lib/messages/types';

interface VoiceNoteBlockProps {
  attachment: Attachment;
}

const BARS = 32;

/** A voice-note player: play/pause, a progress-filled waveform, and elapsed /
 *  total time backed by a hidden `<audio>`. */
export function VoiceNoteBlock({ attachment }: VoiceNoteBlockProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  if (attachment.kind !== 'voice') return null;

  const totalMs = attachment.duration_ms ?? 0;
  const shownMs = progress > 0 ? progress * totalMs : totalMs;

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }

  return (
    <div
      className="flex items-center gap-3 rounded-full px-3 py-2"
      style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', maxWidth: 260 }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
        style={{
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {playing ? (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor" aria-hidden="true">
            <rect x="2" y="1.5" width="2.6" height="8" rx="1" />
            <rect x="6.4" y="1.5" width="2.6" height="8" rx="1" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor" aria-hidden="true">
            <path d="M2 1.5v8l8-4z" />
          </svg>
        )}
      </button>

      <svg
        viewBox="0 0 120 24"
        width="120"
        height="24"
        className="flex-shrink-0"
        aria-hidden="true"
      >
        {Array.from({ length: BARS }).map((_, i) => {
          const h = 4 + (((i * 31) % 16) + ((i * 7) % 5));
          const played = i / BARS <= progress;
          return (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: synthetic, fixed-length waveform
              key={i}
              x={i * 3.6}
              y={(24 - h) / 2}
              width="2.2"
              height={h}
              rx="1"
              fill={played ? 'var(--accent)' : 'var(--ink-muted)'}
              opacity={played ? 0.95 : 0.4}
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
        {fmt(shownMs)}
      </span>

      <audio
        ref={audioRef}
        src={attachment.url || undefined}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.duration && Number.isFinite(a.duration)) setProgress(a.currentTime / a.duration);
        }}
      >
        <track kind="captions" />
      </audio>
    </div>
  );
}

function fmt(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
