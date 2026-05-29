import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from './auth/hooks';
import type { InboxListResponse } from './inbox/types';
import { qk } from './query';

async function mockGet<T>(path: string): Promise<T> {
  const res = await fetch(`/v1${path}`, {
    headers: { authorization: 'Bearer mock' },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function mockPost(path: string): Promise<void> {
  const res = await fetch(`/v1${path}`, {
    method: 'POST',
    headers: { authorization: 'Bearer mock' },
  });
  if (!res.ok && res.status !== 204) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
}

export function useInbox() {
  const { session } = useAuth();
  return useQuery({
    queryKey: qk.inbox.list(),
    enabled: !!session,
    queryFn: () => mockGet<InboxListResponse>('/me/inbox'),
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
  return useMutation({
    mutationFn: (id: string) => mockPost(`/me/inbox/${encodeURIComponent(id)}/read`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.inbox.list() });
    },
  });
}

export function useMarkAllInboxRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => mockPost('/me/inbox/read-all'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.inbox.list() });
    },
  });
}
