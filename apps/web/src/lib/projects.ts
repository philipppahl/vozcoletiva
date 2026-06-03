import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@vozcoletiva/api-client';
import { useMemo } from 'react';

import { apiClient } from './api';
import { completeOnboarding } from './onboarding';
import { qk, STALE } from './query';

type Member = components['schemas']['Member'];

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
    staleTime: STALE.slow,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects');
      return unwrap(data, error);
    },
  });
}

export function useProject(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.projects.detail(slug) : ['projects', 'detail', '_none_'],
    staleTime: STALE.slow,
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
    staleTime: STALE.slow,
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}/members', {
        params: { path: { slug: slug ?? '' } },
      });
      return unwrap(data, error);
    },
  });
}

/**
 * Resolve a project member by user id — for showing an author's avatar + name
 * next to entities (proposals, documents, comments) whose DTOs only carry the
 * author id. Backed by the cached members list, so it's free to call per-row.
 */
export function useMemberLookup(slug: string | undefined): (userId: string) => Member | undefined {
  const members = useMembers(slug);
  return useMemo(() => {
    const map = new Map((members.data?.members ?? []).map((m) => [m.user_id, m]));
    return (userId: string) => map.get(userId);
  }, [members.data]);
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
      completeOnboarding();
    },
  });
}
