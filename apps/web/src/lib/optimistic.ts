import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { toast } from './toast';

/**
 * Optimistic-update plumbing (decision 0026). A mutation updates the local
 * React Query cache *before* the request (so the UI reacts instantly), then the
 * server reconciles in the background. On error we restore the snapshot and, for
 * in-place updates, surface a toast. Message/comment inserts keep a "failed"
 * marker instead — see lib/messages.ts.
 */

// biome-ignore lint/suspicious/noExplicitAny: cache updaters are heterogeneous by key
type Updater = (prev: any) => any;

export interface Patch {
  key: QueryKey;
  update: Updater;
}

export interface OptimisticContext {
  snapshots: Array<[QueryKey, unknown]>;
}

/** Cancel in-flight refetches, snapshot, and apply the optimistic patches. */
export async function applyPatches(qc: QueryClient, patches: Patch[]): Promise<OptimisticContext> {
  const snapshots: Array<[QueryKey, unknown]> = [];
  for (const { key, update } of patches) {
    await qc.cancelQueries({ queryKey: key });
    snapshots.push([key, qc.getQueryData(key)]);
    qc.setQueryData(key, update);
  }
  return { snapshots };
}

export function rollback(qc: QueryClient, ctx: OptimisticContext | undefined) {
  if (!ctx) return;
  for (const [key, prev] of ctx.snapshots) qc.setQueryData(key, prev);
}

/** A unique, client-only id for an optimistic item (replaced by the server id). */
export function tempId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `temp-${rand}`;
}

export function isTempId(id: string): boolean {
  return id.startsWith('temp-');
}

/**
 * Build a `useMutation` config that applies optimistic patches, rolls back +
 * toasts on error, and invalidates on settle. Wrap in `useMutation(...)`.
 */
export function optimistic<TVars, TData>(
  qc: QueryClient,
  opts: {
    mutationFn: (vars: TVars) => Promise<TData>;
    patches: (vars: TVars) => Patch[];
    invalidate?: (vars: TVars, data: TData | undefined) => QueryKey[];
    errorMessage?: string;
    onReconcile?: (data: TData, vars: TVars) => void;
  },
) {
  return {
    mutationFn: opts.mutationFn,
    onMutate: (vars: TVars) => applyPatches(qc, opts.patches(vars)),
    onError: (_err: unknown, _vars: TVars, ctx: OptimisticContext | undefined) => {
      rollback(qc, ctx);
      if (opts.errorMessage) toast.error(opts.errorMessage);
    },
    onSuccess: (data: TData, vars: TVars) => opts.onReconcile?.(data, vars),
    onSettled: (data: TData | undefined, _err: unknown, vars: TVars) => {
      for (const key of opts.invalidate?.(vars, data) ?? []) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
  };
}
