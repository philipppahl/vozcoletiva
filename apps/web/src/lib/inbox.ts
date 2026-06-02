import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './api';
import { useAuth } from './auth/hooks';
import type { InboxListResponse } from './inbox/types';
import { applyPatches, rollback } from './optimistic';
import { qk } from './query';

function unwrap<T>(data: T | undefined, error: unknown): T {
  if (error) throw new Error('inbox request failed');
  if (data === undefined) throw new Error('empty response');
  return data;
}

export function useInbox() {
  const { session } = useAuth();
  return useQuery({
    queryKey: qk.inbox.list(),
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/me/inbox');
      return unwrap(data, error) as unknown as InboxListResponse;
    },
    refetchOnWindowFocus: true,
  });
}

/** Cheap derived hook — same data as useInbox(). */
export function useUnreadInboxCount(): number {
  const inbox = useInbox();
  return inbox.data?.unread_count ?? 0;
}

/** Unread inbox item counts grouped by project slug. Drives the per-project
 *  "news" dots in the switcher + header. */
export function useUnreadByProject(): Record<string, number> {
  const inbox = useInbox();
  const out: Record<string, number> = {};
  for (const item of inbox.data?.items ?? []) {
    if (item.read_at) continue;
    if (!item.project_slug) continue;
    out[item.project_slug] = (out[item.project_slug] ?? 0) + 1;
  }
  return out;
}

export function useMarkInboxItemRead() {
  const qc = useQueryClient();
  const key = qk.inbox.list();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.POST('/v1/me/inbox/{id}/read', {
        params: { path: { id } },
      });
      if (error) throw new Error('failed to mark read');
    },
    onMutate: (id: string) =>
      applyPatches(qc, [
        {
          key,
          update: (l?: InboxListResponse) => {
            if (!l) return l;
            const wasUnread = l.items.some((it) => it.id === id && !it.read_at);
            return {
              ...l,
              items: l.items.map((it) =>
                it.id === id && !it.read_at ? { ...it, read_at: new Date().toISOString() } : it,
              ),
              unread_count: Math.max(0, l.unread_count - (wasUnread ? 1 : 0)),
            };
          },
        },
      ]),
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

export function useMarkAllInboxRead() {
  const qc = useQueryClient();
  const key = qk.inbox.list();
  return useMutation({
    mutationFn: async () => {
      const { error } = await apiClient.POST('/v1/me/inbox/read-all');
      if (error) throw new Error('failed to mark all read');
    },
    onMutate: () =>
      applyPatches(qc, [
        {
          key,
          update: (l?: InboxListResponse) =>
            l
              ? {
                  ...l,
                  items: l.items.map((it) => ({
                    ...it,
                    read_at: it.read_at ?? new Date().toISOString(),
                  })),
                  unread_count: 0,
                }
              : l,
        },
      ]),
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}
