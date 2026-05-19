import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Centralised query-key factory. Every cache key shape lives here so renames
 * and invalidations are uniform.
 */
export const qk = {
  projects: {
    all: ['projects'] as const,
    list: () => ['projects', 'list'] as const,
    detail: (slug: string) => ['projects', 'detail', slug] as const,
    members: (slug: string) => ['projects', 'detail', slug, 'members'] as const,
    invites: (slug: string) => ['projects', 'detail', slug, 'invites'] as const,
    proposals: (slug: string) => ['projects', 'detail', slug, 'proposals'] as const,
    proposal: (slug: string, id: string) => ['projects', 'detail', slug, 'proposals', id] as const,
    comments: (slug: string, id: string) =>
      ['projects', 'detail', slug, 'proposals', id, 'comments'] as const,
  },
  invites: {
    byToken: (token: string) => ['invites', 'by-token', token] as const,
    byCode: (code: string) => ['invites', 'by-code', code] as const,
  },
};
