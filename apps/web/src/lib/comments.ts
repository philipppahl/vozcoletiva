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

export function useComments(slug: string, proposalId: string) {
  return useQuery({
    queryKey: qk.projects.comments(slug, proposalId),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}/proposals/{id}/comments', {
        params: { path: { slug, id: proposalId } },
      });
      return unwrap(data, error);
    },
    refetchOnWindowFocus: true,
  });
}

export function useCreateComment(slug: string, proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await apiClient.POST('/v1/projects/{slug}/proposals/{id}/comments', {
        params: { path: { slug, id: proposalId } },
        body: { body },
      });
      return unwrap(data, error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.comments(slug, proposalId) });
    },
  });
}

export function useEditComment(slug: string, proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { commentId: string; body: string }) => {
      const { data, error } = await apiClient.PATCH(
        '/v1/projects/{slug}/proposals/{id}/comments/{commentId}',
        {
          params: {
            path: { slug, id: proposalId, commentId: vars.commentId },
          },
          body: { body: vars.body },
        },
      );
      return unwrap(data, error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.comments(slug, proposalId) });
    },
  });
}

export function useDeleteComment(slug: string, proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (commentId: string) => {
      const { data, error } = await apiClient.DELETE(
        '/v1/projects/{slug}/proposals/{id}/comments/{commentId}',
        {
          params: { path: { slug, id: proposalId, commentId } },
        },
      );
      return unwrap(data, error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.comments(slug, proposalId) });
    },
  });
}
