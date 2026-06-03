import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useEffect, useRef, useState } from 'react';

import { useLightbox } from '../../lib/lightbox';

/**
 * Full-screen image viewer (decision 0031). Tapping a chat image opens it here;
 * swipe (or arrow keys) move between the images of that message. Download +
 * close; tap the backdrop to dismiss. Mounted once at the app root.
 */
export function Lightbox() {
  const { _ } = useLingui();
  const { open, images, index, close, next, prev } = useLightbox();
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);

  // Escape / arrow-key navigation.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, next, prev]);

  if (!open) return null;
  const current = images[index];
  if (!current) return null;
  const many = images.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={_(t`Image`)}
      className="fixed inset-0 z-[80] flex flex-col"
      style={{ background: 'rgba(0,0,0,0.92)' }}
    >
      {/* Backdrop: a real button so tap-to-dismiss is keyboard-accessible. */}
      <button
        type="button"
        onClick={close}
        aria-label={_(t`Close`)}
        className="absolute inset-0"
        style={{ background: 'transparent', border: 'none', cursor: 'default' }}
      />

      {/* Top bar: counter + download + close. */}
      <div
        className="relative z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2"
        style={{ color: '#fff' }}
      >
        <span className="text-sm" style={{ opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>
          {many ? `${index + 1} / ${images.length}` : ''}
        </span>
        <span className="flex items-center gap-1">
          <a
            href={current.url}
            download={current.name || ''}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full"
            style={{ color: '#fff' }}
          >
            <span className="sr-only">
              <Trans>Download</Trans>
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <button
            type="button"
            onClick={close}
            aria-label={_(t`Close`)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </span>
      </div>

      {/* Image stage: a swipe surface (pointer events only — not a click target). */}
      <div
        // biome-ignore lint/a11y/noStaticElementInteractions: swipe surface; navigation is also available via arrow keys + on-screen buttons
        className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-2"
        style={{ minHeight: 0, touchAction: 'pan-y' }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (start.current) setDx(e.clientX - start.current.x);
        }}
        onPointerUp={() => {
          if (Math.abs(dx) > 60) {
            if (dx < 0) next();
            else prev();
          }
          setDx(0);
          start.current = null;
        }}
      >
        <img
          src={current.url}
          alt=""
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: dx ? `translateX(${dx}px)` : undefined,
            transition: dx ? 'none' : 'transform 0.18s ease',
          }}
        />
      </div>

      {/* Desktop prev/next affordances. */}
      {many && (
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-10 hidden items-center justify-between px-3 md:flex">
          <ArrowButton dir="prev" disabled={index === 0} onClick={prev} label={_(t`Previous`)} />
          <ArrowButton
            dir="next"
            disabled={index === images.length - 1}
            onClick={next}
            label={_(t`Next`)}
          />
        </div>
      )}
    </div>
  );
}

function ArrowButton({
  dir,
  disabled,
  onClick,
  label,
}: {
  dir: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full"
      style={{
        background: 'rgba(255,255,255,0.12)',
        border: 'none',
        color: '#fff',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={dir === 'prev' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
