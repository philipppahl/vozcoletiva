import { DEFAULT_THEME, type Theme } from '@vozcoletiva/shared';
import { create } from 'zustand';

const STORAGE_KEY = 'voz.theme';

function readPersistedTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return DEFAULT_THEME;
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

interface ThemeStore {
  theme: Theme;
  setTheme: (next: Theme) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: readPersistedTheme(),
  setTheme: (next) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    applyTheme(next);
    set({ theme: next });
  },
}));

/** Run once at app bootstrap to sync the DOM with the persisted preference. */
export function initTheme() {
  applyTheme(readPersistedTheme());
}
