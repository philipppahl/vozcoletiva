/**
 * Shared TS types and constants used across `apps/web` and `apps/infra`.
 *
 * This package stays intentionally small. Anything that could live in a feature
 * package's local types should not be hoisted here just because it might be reused.
 */

export type Locale = 'en' | 'pt';
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'pt'] as const;
export const DEFAULT_LOCALE: Locale = 'en';

export type Theme = 'light' | 'dark' | 'system';
export const DEFAULT_THEME: Theme = 'system';

export type EnvName = 'dev' | 'prod';

/** Branded ID types — production code will narrow these via parsers, not casts. */
export type UserId = string & { readonly __brand: 'UserId' };
export type ProjectId = string & { readonly __brand: 'ProjectId' };
export type ProposalId = string & { readonly __brand: 'ProposalId' };
