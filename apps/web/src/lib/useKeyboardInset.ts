import { useEffect, useState } from 'react';

/**
 * Height (px) the on-screen keyboard currently overlaps the layout, derived
 * from the VisualViewport. 0 when the keyboard is closed.
 *
 * Robust across `interactive-widget` modes: with `resizes-content` the layout
 * viewport itself shrinks (overlap ≈ 0); with `resizes-visual` (the default)
 * only the visual viewport shrinks, so the overlap equals the keyboard height
 * — letting bottom-anchored sheets lift above it. Falls back to 0 where
 * VisualViewport is unavailable.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const update = () => {
      const overlap = window.innerHeight - (vv.height + vv.offsetTop);
      // Ignore small deltas from the URL bar collapsing; a keyboard is tall.
      setInset(overlap > 80 ? overlap : 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
