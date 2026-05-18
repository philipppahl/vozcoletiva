/// <reference types="vite/client" />

/**
 * Lingui's vite plugin transpiles `.po` imports into JS modules that export
 * `{ messages: Record<string, string> }`. Surface that shape to TypeScript.
 */
declare module '*.po' {
  export const messages: Record<string, string>;
}
