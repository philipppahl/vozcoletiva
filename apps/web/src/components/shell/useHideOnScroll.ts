import { useEffect, useState } from 'react';

/**
 * Hide-on-scroll-down / reveal-on-scroll-up, X-app style. Watches the window
 * scroll position and returns whether the chrome (header + footer) should be
 * hidden. The caller applies a transform.
 *
 * Behaviour:
 *  - Reveals whenever you scroll up, or near the very top.
 *  - Hides once you've scrolled down past `revealThreshold` from the top AND
 *    moved down by more than `delta` since the last direction change (avoids
 *    jitter on tiny scrolls).
 *  - Honours `prefers-reduced-motion`: never hides (chrome stays put).
 */
export function useHideOnScroll(options?: { delta?: number; revealThreshold?: number }): boolean {
  const delta = options?.delta ?? 8;
  const revealThreshold = options?.revealThreshold ?? 64;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;

    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = window.scrollY;
      // Always show near the top.
      if (y <= revealThreshold) {
        setHidden(false);
        lastY = y;
        return;
      }
      const diff = y - lastY;
      if (Math.abs(diff) < delta) return; // ignore micro-scrolls
      setHidden(diff > 0); // scrolling down → hide; up → show
      lastY = y;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [delta, revealThreshold]);

  return hidden;
}
