import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

export function useProjects() {
  return useQuery({
    queryKey: qk.projects.list(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects');
      return unwrap(data, error);
    },
  });
}

export function useProject(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.projects.detail(slug) : ['projects', 'detail', '_none_'],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}', {
        params: { path: { slug: slug ?? '' } },
      });
      return unwrap(data, error);
    },
  });
}

export function useMembers(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.projects.members(slug) : ['projects', 'members', '_none_'],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}/members', {
        params: { path: { slug: slug ?? '' } },
      });
      return unwrap(data, error);
    },
  });
}

export interface CreateProjectInput {
  name: string;
  slug: string;
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const { data, error } = await apiClient.POST('/v1/projects', {
        body: { name: input.name, slug: input.slug, template: 'custom' },
      });
      return unwrap(data, error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.list() });
    },
  });
}
