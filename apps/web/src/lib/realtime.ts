import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { create } from 'zustand';
import { refresh } from './auth/cognito';
import { useAuthStore } from './auth/store';
import { env } from './env';
import { qk } from './query';

/**
 * Whether the realtime WebSocket is currently up. `messages.ts` reads this to
 * back chat polling off to a slow safety-net interval while live delivery is
 * carrying the load (decision 0028; polling is the 0027 fallback).
 */
interface RealtimeStore {
  connected: boolean;
  setConnected: (connected: boolean) => void;
}
export const useRealtimeStore = create<RealtimeStore>((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),
}));

const SKEW_SECONDS = 30; // refresh a touch before expiry (mirrors api.ts)
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

/** A non-expired access token, refreshing if necessary. Null if signed out. */
async function freshAccessToken(): Promise<string | null> {
  const session = useAuthStore.getState().session;
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  if (session.tokens.expiresAt - SKEW_SECONDS > now) return session.tokens.accessToken;
  try {
    const fresh = await refresh(session.email, session.tokens.refreshToken);
    useAuthStore.getState().updateTokens(fresh);
    return fresh.accessToken;
  } catch {
    return null;
  }
}

/**
 * Opens a single WebSocket to the realtime API while signed in and turns
 * `message.created` signals into React Query invalidations — the same merge
 * path the mock `useMessageBusBridge` uses, so any open conversation reflects a
 * new message without a manual refetch. Reconnects with capped exponential
 * backoff and a refreshed token. Dormant (chat stays on polling) when
 * `VITE_WS_URL` is unset. Mount once near the app root.
 */
export function useRealtimeSocket() {
  const qc = useQueryClient();
  const status = useAuthStore((s) => s.status);
  const setConnected = useRealtimeStore((s) => s.setConnected);

  useEffect(() => {
    const base = env().wsUrl;
    if (!base || status !== 'signed-in') return undefined;

    let ws: WebSocket | null = null;
    let backoff = INITIAL_BACKOFF_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false; // set on cleanup so we stop reconnecting

    const onSignal = (raw: string) => {
      let evt: { type?: string; conversationId?: string; parentMessageId?: string | null };
      try {
        evt = JSON.parse(raw);
      } catch {
        return;
      }
      if (evt.type !== 'message.created') return;
      // Refetch through the existing REST queries; the optimistic-merge dedup
      // (0027) reconciles the just-sent bubble with the authoritative server row.
      if (evt.conversationId) {
        void qc.invalidateQueries({ queryKey: qk.chat.messages(evt.conversationId) });
      }
      if (evt.parentMessageId) {
        void qc.invalidateQueries({ queryKey: qk.chat.thread(evt.parentMessageId) });
      }
      void qc.invalidateQueries({ queryKey: qk.chat.dms() });
      void qc.invalidateQueries({ queryKey: ['projects'], exact: false });
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => void connect(), backoff);
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    };

    const connect = async () => {
      if (stopped) return;
      const token = await freshAccessToken();
      if (!token) {
        scheduleReconnect();
        return;
      }
      const socket = new WebSocket(`${base}?token=${encodeURIComponent(token)}`);
      ws = socket;
      socket.onopen = () => {
        backoff = INITIAL_BACKOFF_MS;
        setConnected(true);
      };
      socket.onmessage = (e) => onSignal(typeof e.data === 'string' ? e.data : '');
      socket.onclose = () => {
        setConnected(false);
        // API Gateway idle-closes after ~10 min of quiet; reconnect transparently.
        scheduleReconnect();
      };
      socket.onerror = () => {
        try {
          socket.close();
        } catch {
          /* close() can throw if never opened — ignore */
        }
      };
    };

    void connect();

    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      setConnected(false);
      if (ws) {
        ws.onclose = null; // don't let teardown trigger a reconnect
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, [qc, status, setConnected]);
}
