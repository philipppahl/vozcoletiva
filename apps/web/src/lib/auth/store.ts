import { create } from 'zustand';

import type { Tokens } from './cognito';

const SESSION_KEY = 'voz.auth.session';

/**
 * Authentication state. Tokens persist to localStorage so a page refresh
 * doesn't sign the user out.
 *
 * Trade-off: localStorage tokens are XSS-readable. The PWA renders user
 * content only through sanitized markdown (`rehype-sanitize` on every
 * render + `ammonia` on the server). When the first un-sanitized content
 * surface arrives, revisit this and consider httpOnly-cookie storage with
 * a tiny BE shim. Tracked in docs/conventions/validation.md.
 */
export interface AuthSession {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  tokens: Tokens;
}

interface AuthStore {
  status: 'unknown' | 'signed-out' | 'signed-in';
  session: AuthSession | null;
  hydrate: () => void;
  setSession: (session: AuthSession) => void;
  updateTokens: (tokens: Tokens) => void;
  clear: () => void;
}

function readPersisted(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function persist(session: AuthSession | null) {
  if (typeof window === 'undefined') return;
  if (session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(SESSION_KEY);
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  status: 'unknown',
  session: null,
  hydrate: () => {
    const persisted = readPersisted();
    set({
      session: persisted,
      status: persisted ? 'signed-in' : 'signed-out',
    });
  },
  setSession: (session) => {
    persist(session);
    set({ session, status: 'signed-in' });
  },
  updateTokens: (tokens) => {
    const current = get().session;
    if (!current) return;
    const next = { ...current, tokens };
    persist(next);
    set({ session: next });
  },
  clear: () => {
    persist(null);
    set({ session: null, status: 'signed-out' });
  },
}));
