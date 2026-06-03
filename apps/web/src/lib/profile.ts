import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { apiClient } from './api';
import { useAuthStore } from './auth/store';
import { syncSessionAvatar } from './avatar';
import { qk } from './query';
import { toast } from './toast';

export interface Profile {
  user_id: string;
  display_name: string;
  handle?: string | null;
  locale: string;
  theme: string;
  created_at: string;
  avatar_url?: string | null;
}

/**
 * The caller's backend profile (`GET /v1/me`). Cognito holds auth only, so this
 * is the source of truth for the display name (decision 0019). Enabled only when
 * signed in.
 */
export function useProfile() {
  const status = useAuthStore((s) => s.status);
  return useQuery({
    queryKey: qk.me(),
    enabled: status === 'signed-in',
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await apiClient.GET('/v1/me');
      if (error || !data) throw new Error('failed to load profile');
      return data as Profile;
    },
  });
}

/** Set the caller's display name (`PATCH /v1/me`); syncs the auth session. */
export function useUpdateDisplayName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string): Promise<Profile> => {
      const { data, error } = await apiClient.PATCH('/v1/me', {
        body: { display_name: displayName },
      });
      if (error || !data) throw new Error('failed to update display name');
      return data as Profile;
    },
    // Flip the name/avatar instantly.
    onMutate: (displayName: string) => {
      const prev = useAuthStore.getState().session?.displayName;
      syncSessionName(displayName);
      qc.setQueryData<Profile | undefined>(qk.me(), (p) =>
        p ? { ...p, display_name: displayName } : p,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) syncSessionName(ctx.prev);
      toast.error('Couldn’t update your name. Please try again.');
    },
    onSuccess: (profile) => {
      syncSessionName(profile.display_name);
      qc.setQueryData(qk.me(), profile);
    },
  });
}

/**
 * Keeps `session.displayName` in step with the canonical backend profile.
 * Mount once near the app root. The placeholder set at sign-in (email
 * local-part) is replaced as soon as `GET /v1/me` resolves.
 */
export function useSyncProfileName() {
  const { data } = useProfile();
  useEffect(() => {
    if (data?.display_name) syncSessionName(data.display_name);
  }, [data?.display_name]);
  // Keep the session avatar in step too, so the user's own photo shows in the
  // shell without each surface fetching the profile.
  useEffect(() => {
    syncSessionAvatar(data?.avatar_url ?? null);
  }, [data?.avatar_url]);
  // And the handle, so surfaces can show @handle without refetching.
  useEffect(() => {
    if (data) syncSessionHandle(data.handle ?? null);
  }, [data]);
}

function syncSessionHandle(handle: string | null) {
  const store = useAuthStore.getState();
  if (store.session && (store.session.handle ?? null) !== handle) {
    store.setSession({ ...store.session, handle });
  }
}

function syncSessionName(displayName: string) {
  const store = useAuthStore.getState();
  if (store.session && store.session.displayName !== displayName) {
    store.setSession({ ...store.session, displayName });
  }
}
