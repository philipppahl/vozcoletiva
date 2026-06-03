import { type ReactNode, useRef, useState } from 'react';

interface SwipePagerProps {
  /** Active pane index. */
  index: number;
  onIndexChange: (index: number) => void;
  panes: ReactNode[];
}

const SWIPE_THRESHOLD = 56; // px of horizontal travel to commit a switch
const AXIS_LOCK = 8; // px before we decide the gesture is horizontal vs vertical
const EDGE_RESIST = 0.35; // rubber-band factor when dragging past the first/last pane

/**
 * Horizontal pager that switches between full-width panes with a transform.
 * The row follows the finger during a horizontal drag (locked against vertical
 * scroll via `touch-action: pan-y`) and springs to the nearest pane on release
 * — a tap on the segmented control animates the same way. Vertical drags fall
 * through to the page's scroll container so the header/footer keep working.
 */
export function SwipePager({ index, onIndexChange, panes }: SwipePagerProps) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<'h' | 'v' | null>(null);
  const [dragX, setDragX] = useState<number | null>(null);
  const n = panes.length;

  const reset = () => {
    start.current = null;
    axis.current = null;
    setDragX(null);
  };

  return (
    <div style={{ overflowX: 'hidden', width: '100%' }}>
      <div
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (!t) return;
          start.current = { x: t.clientX, y: t.clientY };
          axis.current = null;
        }}
        onTouchMove={(e) => {
          const s = start.current;
          const t = e.touches[0];
          if (!s || !t) return;
          const dx = t.clientX - s.x;
          const dy = t.clientY - s.y;
          if (axis.current === null) {
            if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
            axis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
          }
          if (axis.current !== 'h') return;
          // Resist dragging past the first / last pane so the edge feels bounded.
          const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === n - 1);
          setDragX(atEdge ? dx * EDGE_RESIST : dx);
        }}
        onTouchEnd={() => {
          const committed = dragX ?? 0;
          if (axis.current === 'h') {
            if (committed <= -SWIPE_THRESHOLD && index < n - 1) onIndexChange(index + 1);
            else if (committed >= SWIPE_THRESHOLD && index > 0) onIndexChange(index - 1);
          }
          reset();
        }}
        onTouchCancel={reset}
        style={{
          display: 'flex',
          width: `${n * 100}%`,
          transform: `translateX(calc(-${(index * 100) / n}% + ${dragX ?? 0}px))`,
          transition: dragX === null ? 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          willChange: 'transform',
          alignItems: 'flex-start',
          touchAction: 'pan-y',
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
