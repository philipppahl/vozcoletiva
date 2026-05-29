/**
 * Single source of truth for whether mock mode is on. Driven by Vite's
 * compile-time env so the prod bundle can tree-shake the mocks subtree out.
 */
export function isMockMode(): boolean {
  return import.meta.env.VITE_USE_MOCKS === '1';
}
