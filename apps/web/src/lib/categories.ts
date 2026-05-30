import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './api';
import { qk } from './query';

function unwrap<T>(data: T | undefined, error: unknown): T {
  if (error) {
    throw new Error(
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'request failed',
    );
  }
  if (data === undefined) throw new Error('empty response');
  return data;
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
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}/categories', {
        params: { path: { slug: slug ?? '' } },
      });
      return unwrap(data, error);
    },
  });
}

export function useCreateCategory(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data, error } = await apiClient.POST('/v1/projects/{slug}/categories', {
        params: { path: { slug } },
        body: input,
      });
      return unwrap(data, error);
    },
    onSuccess: () => invalidate(qc, slug),
  });
}

export function useRenameCategory(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { data, error } = await apiClient.PATCH('/v1/projects/{slug}/categories/{id}', {
        params: { path: { slug, id: input.id } },
        body: { name: input.name },
      });
      return unwrap(data, error);
    },
    onSuccess: () => invalidate(qc, slug),
  });
}

export function useDeleteCategory(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await apiClient.DELETE('/v1/projects/{slug}/categories/{id}', {
        params: { path: { slug, id } },
      });
      if (error) {
        throw new Error(
          typeof error === 'object' && error && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'request failed',
        );
      }
    },
    onSuccess: () => invalidate(qc, slug),
  });
}
