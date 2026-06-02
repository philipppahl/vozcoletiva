import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@vozcoletiva/api-client';

import { apiClient } from './api';
import { applyPatches, rollback, tempId } from './optimistic';
import { qk } from './query';
import { toast } from './toast';

type Category = components['schemas']['Category'];
interface CategoryList {
  categories: Category[];
}

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
  const key = qk.projects.categories(slug);
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data, error } = await apiClient.POST('/v1/projects/{slug}/categories', {
        params: { path: { slug } },
        body: input,
      });
      return unwrap(data, error);
    },
    onMutate: (input: { name: string }) =>
      applyPatches(qc, [
        {
          key,
          update: (l?: CategoryList) =>
            l
              ? {
                  ...l,
                  categories: [
                    ...l.categories,
                    { id: tempId(), name: input.name, position: l.categories.length },
                  ],
                }
              : l,
        },
      ]),
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Couldn’t add the topic. Please try again.');
    },
    onSettled: () => invalidate(qc, slug),
  });
}

export function useRenameCategory(slug: string) {
  const qc = useQueryClient();
  const key = qk.projects.categories(slug);
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const { data, error } = await apiClient.PATCH('/v1/projects/{slug}/categories/{id}', {
        params: { path: { slug, id: input.id } },
        body: { name: input.name },
      });
      return unwrap(data, error);
    },
    onMutate: (input: { id: string; name: string }) =>
      applyPatches(qc, [
        {
          key,
          update: (l?: CategoryList) =>
            l
              ? {
                  ...l,
                  categories: l.categories.map((c) =>
                    c.id === input.id ? { ...c, name: input.name } : c,
                  ),
                }
              : l,
        },
      ]),
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Couldn’t rename the topic. Please try again.');
    },
    onSettled: () => invalidate(qc, slug),
  });
}

export function useDeleteCategory(slug: string) {
  const qc = useQueryClient();
  const key = qk.projects.categories(slug);
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
    onMutate: (id: string) =>
      applyPatches(qc, [
        {
          key,
          update: (l?: CategoryList) =>
            l ? { ...l, categories: l.categories.filter((c) => c.id !== id) } : l,
        },
      ]),
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Couldn’t delete the topic. Please try again.');
    },
    onSettled: () => invalidate(qc, slug),
  });
}
