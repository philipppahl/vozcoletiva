import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from '@vozcoletiva/shared';

/**
 * i18n bootstrap placeholder.
 *
 * Lingui's runtime + macro infrastructure lands in the auth slice (the first
 * feature that surfaces user-visible strings). The foundation slice ships only
 * the locale catalogue files (empty), the locale-selection plumbing, and the
 * default-locale fallback so subsequent feature work can drop translations in
 * without re-architecting.
 */

const STORAGE_KEY = 'voz.locale';

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const candidate = navigator.language.slice(0, 2).toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(candidate)
    ? (candidate as Locale)
    : DEFAULT_LOCALE;
}

export function currentLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
    return stored as Locale;
  }
  return detectBrowserLocale();
}

export function setLocale(locale: Locale) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
}
