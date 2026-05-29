import { useQuery } from '@tanstack/react-query';

import type { DocumentDetail, DocumentListResponse } from './documents/types';
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

export function useDocuments(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.projects.documents(slug) : ['documents', '_none_'],
    enabled: !!slug,
    queryFn: () =>
      mockGet<DocumentListResponse>(`/projects/${encodeURIComponent(slug ?? '')}/documents`),
  });
}

export function useDocument(slug: string | undefined, name: string | undefined) {
  return useQuery({
    queryKey: slug && name ? qk.projects.document(slug, name) : ['documents', '_detail_', '_none_'],
    enabled: !!slug && !!name,
    queryFn: () =>
      mockGet<DocumentDetail>(
        `/projects/${encodeURIComponent(slug ?? '')}/documents/by-name/${encodeURIComponent(
          name ?? '',
        )}`,
      ),
  });
}
