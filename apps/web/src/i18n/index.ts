import { i18n } from '@lingui/core';
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from '@vozcoletiva/shared';

import { messages as enMessages } from './locales/en/messages.po';
import { messages as ptMessages } from './locales/pt/messages.po';

const STORAGE_KEY = 'voz.locale';

const CATALOGUES: Record<Locale, { messages: Record<string, string> }> = {
  en: { messages: enMessages },
  pt: { messages: ptMessages },
};

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
  i18n.load(locale, CATALOGUES[locale].messages);
  i18n.activate(locale);
}

export function initI18n() {
  // Load both catalogues so language switches don't require a network hop.
  for (const locale of SUPPORTED_LOCALES) {
    i18n.load(locale, CATALOGUES[locale].messages);
  }
  const locale = currentLocale();
  i18n.activate(locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}
