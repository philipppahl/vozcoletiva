/**
 * Pure handle logic — no React, no API client — so it's unit-testable without
 * the app's compile-time env. The hooks (`useHandleAvailability`,
 * `useSetHandle`) live in `./handle` and re-export these.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

/**
 * Why a code, not a string: this module can't translate. Components map the code
 * → a `<Trans>` message. Mirrors the server's `domain::handle::validate_handle`
 * shape rules (length, charset, leading letter); `reserved` + uniqueness are the
 * availability endpoint's authority.
 */
export type HandleShapeError = 'too_short' | 'too_long' | 'start_letter' | 'charset';

export type Availability =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'taken' }
  | { state: 'invalid' };

const CHARSET = /^[a-z0-9_]+$/;

/** Canonical form the server would store: trimmed + lowercased. */
export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Local-only shape check (instant feedback); null when the shape is valid. */
export function handleShapeError(raw: string): HandleShapeError | null {
  const h = normalizeHandle(raw);
  if (h.length < HANDLE_MIN) return 'too_short';
  if (h.length > HANDLE_MAX) return 'too_long';
  if (!/^[a-z]/.test(h)) return 'start_letter';
  if (!CHARSET.test(h)) return 'charset';
  return null;
}

/** Derive a starter handle from an email local-part (best-effort, may be empty
 *  or too short — the user confirms/edits it). */
export function suggestHandle(email: string): string {
  const local = email.split('@')[0] ?? '';
  // Lowercase, drop disallowed chars, strip leading non-letters, cap length.
  return local
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, HANDLE_MAX);
}
