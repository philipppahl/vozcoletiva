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
    proposalTree: (slug: string, id: string) =>
      ['projects', 'detail', slug, 'proposals', id, 'tree'] as const,
    comments: (slug: string, id: string) =>
      ['projects', 'detail', slug, 'proposals', id, 'comments'] as const,
    channels: (slug: string) => ['projects', 'detail', slug, 'channels'] as const,
    documents: (slug: string) => ['projects', 'detail', slug, 'documents'] as const,
    document: (slug: string, name: string) =>
      ['projects', 'detail', slug, 'documents', name] as const,
    search: (slug: string, query: string) => ['projects', 'detail', slug, 'search', query] as const,
    categories: (slug: string) => ['projects', 'detail', slug, 'categories'] as const,
  },
  invites: {
    byToken: (token: string) => ['invites', 'by-token', token] as const,
    byCode: (code: string) => ['invites', 'by-code', code] as const,
  },
  inbox: {
    list: () => ['inbox', 'list'] as const,
  },
  chat: {
    dms: () => ['chat', 'dms'] as const,
    conversation: (id: string) => ['chat', 'conversation', id] as const,
    messages: (conversationId: string) =>
      ['chat', 'conversation', conversationId, 'messages'] as const,
    thread: (parentMessageId: string) => ['chat', 'thread', parentMessageId] as const,
  },
};
