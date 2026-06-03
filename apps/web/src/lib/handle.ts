import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiClient } from './api';
import { useAuthStore } from './auth/store';
import { type Availability, handleShapeError, normalizeHandle } from './handle-shape';
import type { Profile } from './profile';
import { qk } from './query';

export type { Availability, HandleShapeError } from './handle-shape';
// Re-export the pure logic so callers keep importing everything from `./handle`.
export {
  HANDLE_MAX,
  HANDLE_MIN,
  handleShapeError,
  normalizeHandle,
  suggestHandle,
} from './handle-shape';

/**
 * Debounced live availability of a candidate handle (`GET
 * /v1/handles/{handle}/availability`). Auth-optional on the server, so it works
 * on the sign-up form (anonymous) and in Preferences (authenticated — your own
 * current handle reads as available). Returns `idle` until the shape is valid.
 */
export function useHandleAvailability(raw: string): Availability {
  const handle = normalizeHandle(raw);
  const shapeOk = handleShapeError(raw) === null;
  const debounced = useDebouncedValue(handle, 350);
  const ready = shapeOk && debounced === handle;

  const query = useQuery({
    queryKey: ['handle-availability', handle],
    enabled: ready,
    staleTime: 10_000,
    retry: false,
    queryFn: async (): Promise<boolean> => {
      const { data, error, response } = await apiClient.GET('/v1/handles/{handle}/availability', {
        params: { path: { handle } },
      });
      // A 400 means reserved/malformed — treat as unavailable, not a crash.
      if (response?.status === 400) return false;
      if (error || !data) throw new Error('availability check failed');
      return data.available;
    },
  });

  if (!shapeOk) return { state: 'idle' };
  if (!ready || query.isFetching) return { state: 'checking' };
  if (query.isError) return { state: 'idle' };
  if (query.data === undefined) return { state: 'checking' };
  return query.data ? { state: 'available' } : { state: 'taken' };
}

/** Claim/change the caller's handle (`PUT /v1/me/handle`); updates the profile
 *  cache so the null-handle gate dismisses and Preferences reflects it. */
export function useSetHandle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (raw: string): Promise<string> => {
      const handle = normalizeHandle(raw);
      const { data, error } = await apiClient.PUT('/v1/me/handle', {
        body: { handle },
      });
      if (error || !data) {
        // Surface a stable reason so the caller can show the right message.
        throw new HandleError(handleErrorCode(error));
      }
      return data.handle;
    },
    onSuccess: (handle) => {
      qc.setQueryData<Profile | undefined>(qk.me(), (p) => (p ? { ...p, handle } : p));
      syncSessionHandle(handle);
    },
  });
}

/** A claim failure with a discriminable reason (`taken` vs `invalid` vs
 *  `unknown`) so callers can pick the right copy. */
export class HandleError extends Error {
  constructor(public reason: 'taken' | 'invalid' | 'unknown') {
    super(reason);
    this.name = 'HandleError';
  }
}

function handleErrorCode(error: unknown): 'taken' | 'invalid' | 'unknown' {
  const code = (error as { error?: string } | undefined)?.error;
  if (code === 'conflict') return 'taken';
  if (code === 'bad_request') return 'invalid';
  return 'unknown';
}

function syncSessionHandle(handle: string) {
  const store = useAuthStore.getState();
  if (store.session && store.session.handle !== handle) {
    store.setSession({ ...store.session, handle });
  }
}

/** Generic value debouncer (no extra deps). */
function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
