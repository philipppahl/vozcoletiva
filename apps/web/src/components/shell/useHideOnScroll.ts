import { useEffect, useState } from 'react';

/**
 * Hide-on-scroll-down / reveal-on-scroll-up, X-app style. Returns whether the
 * chrome (header + footer) should be hidden; the caller applies a transform.
 *
 * Watches `el` when provided (an internal scroll container), else the window.
 * The shell now scrolls an internal element rather than the document — a fixed
 * `h-dvh` frame with no document scroll, so the pinned header/footer can't
 * drift on overscroll.
 *
 * Behaviour:
 *  - Reveals whenever you scroll up, or near the very top.
 *  - Hides once you've scrolled down past `revealThreshold` from the top AND
 *    moved down by more than `delta` since the last direction change (avoids
 *    jitter on tiny scrolls).
 *  - Honours `prefers-reduced-motion`: never hides (chrome stays put).
 */
export function useHideOnScroll(
  el?: HTMLElement | null,
  options?: { delta?: number; revealThreshold?: number },
): boolean {
  const delta = options?.delta ?? 8;
  const revealThreshold = options?.revealThreshold ?? 64;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;

    const target: HTMLElement | Window = el ?? window;
    const scrollY = () => (el ? el.scrollTop : window.scrollY);

    let lastY = scrollY();
    let ticking = false;

    const update = () => {
      ticking = false;
      const y = scrollY();
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

    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, [el, delta, revealThreshold]);

  return hidden;
}
