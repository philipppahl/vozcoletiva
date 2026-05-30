import { useQuery } from '@tanstack/react-query';

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

export function useDocuments(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.projects.documents(slug) : ['documents', '_none_'],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}/documents', {
        params: { path: { slug: slug ?? '' } },
      });
      return unwrap(data, error);
    },
  });
}

export function useDocument(slug: string | undefined, name: string | undefined) {
  return useQuery({
    queryKey: slug && name ? qk.projects.document(slug, name) : ['documents', '_detail_', '_none_'],
    enabled: !!slug && !!name,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}/documents/by-name/{name}', {
        params: { path: { slug: slug ?? '', name: name ?? '' } },
      });
      return unwrap(data, error);
    },
  });
}
