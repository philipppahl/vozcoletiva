import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Category, CategoryListResponse } from './categories/types';
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

async function mockJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/v1${path}`, {
    method,
    headers: { authorization: 'Bearer mock', 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(errBody.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function invalidate(qc: QueryClient, slug: string) {
  void qc.invalidateQueries({ queryKey: qk.projects.categories(slug) });
  // Cards + filter rows show category names from the proposal list, so
  // bump them too on rename.
  void qc.invalidateQueries({ queryKey: qk.projects.proposals(slug) });
  void qc.invalidateQueries({ queryKey: qk.projects.documents(slug) });
}

export function useCategories(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.projects.categories(slug) : ['categories', '_none_'],
    enabled: !!slug,
    queryFn: () =>
      mockGet<CategoryListResponse>(`/projects/${encodeURIComponent(slug ?? '')}/categories`),
  });
}

export function useCreateCategory(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) =>
      mockJson<Category>('POST', `/projects/${encodeURIComponent(slug)}/categories`, input),
    onSuccess: () => invalidate(qc, slug),
  });
}

export function useRenameCategory(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      mockJson<Category>(
        'PATCH',
        `/projects/${encodeURIComponent(slug)}/categories/${encodeURIComponent(input.id)}`,
        { name: input.name },
      ),
    onSuccess: () => invalidate(qc, slug),
  });
}

export function useDeleteCategory(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      mockJson<void>(
        'DELETE',
        `/projects/${encodeURIComponent(slug)}/categories/${encodeURIComponent(id)}`,
      ),
    onSuccess: () => invalidate(qc, slug),
  });
}
