import { type ReactNode, useRef } from 'react';

interface SwipePagerProps {
  /** Active pane index. */
  index: number;
  onIndexChange: (index: number) => void;
  panes: ReactNode[];
}

const SWIPE_THRESHOLD = 56; // px of horizontal travel to switch

/**
 * Horizontal pager that switches between full-width panes with a transform
 * (not a scroll container) — so the page keeps scrolling the window
 * vertically and the dynamic header/footer keep working. Horizontal swipes
 * are detected via touch handlers; vertical drags fall through to the page.
 */
export function SwipePager({ index, onIndexChange, panes }: SwipePagerProps) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const n = panes.length;

  return (
    <div style={{ overflowX: 'hidden', width: '100%' }}>
      <div
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) start.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const s = start.current;
          start.current = null;
          if (!s) return;
          const t = e.changedTouches[0];
          if (!t) return;
          const dx = t.clientX - s.x;
          const dy = t.clientY - s.y;
          // Only treat as a horizontal swipe if it's clearly horizontal.
          if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
          if (dx < 0 && index < n - 1) onIndexChange(index + 1);
          else if (dx > 0 && index > 0) onIndexChange(index - 1);
        }}
        style={{
          display: 'flex',
          width: `${n * 100}%`,
          transform: `translateX(-${(index * 100) / n}%)`,
          transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'transform',
          alignItems: 'flex-start',
        }}
      >
        {panes.map((pane, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length pane list, order is stable
            key={i}
            style={{ width: `${100 / n}%`, flexShrink: 0 }}
            aria-hidden={i !== index}
          >
            {pane}
          </div>
        ))}
      </div>
    </div>
  );
}
