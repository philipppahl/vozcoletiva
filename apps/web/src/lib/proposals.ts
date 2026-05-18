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

export function useProposals(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.projects.proposals(slug) : ['projects', 'proposals', '_none_'],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}/proposals', {
        params: { path: { slug: slug ?? '' } },
      });
      return unwrap(data, error);
    },
    refetchOnWindowFocus: true,
  });
}

export function useProposal(slug: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: slug && id ? qk.projects.proposal(slug, id) : ['projects', 'proposal', '_none_'],
    enabled: !!slug && !!id,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}/proposals/{id}', {
        params: { path: { slug: slug ?? '', id: id ?? '' } },
      });
      return unwrap(data, error);
    },
    refetchOnWindowFocus: true,
    // While voting is open, refetch every 5s so the tally feels live without
    // needing a WebSocket. Real-time arrives in the chat slice.
    refetchInterval: (q) => (q.state.data?.status === 'voting' ? 5_000 : false),
  });
}

export interface CreateProposalInput {
  slug: string;
  title: string;
  body: string;
  voting_mode: 'simple_majority' | 'qualified_two_thirds';
  ends_at: string; // ISO
  quorum?: number;
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProposalInput) => {
      const { data, error } = await apiClient.POST('/v1/projects/{slug}/proposals', {
        params: { path: { slug: input.slug } },
        body: {
          title: input.title,
          body: input.body,
          voting_mode: input.voting_mode,
          ends_at: input.ends_at,
          ...(input.quorum !== undefined && { quorum: input.quorum }),
        },
      });
      return unwrap(data, error);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: qk.projects.proposals(vars.slug) });
    },
  });
}

export function useCastVote(slug: string, proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (choice: 'yes' | 'no' | 'abstain') => {
      const { data, error } = await apiClient.POST('/v1/projects/{slug}/proposals/{id}/vote', {
        params: { path: { slug, id: proposalId } },
        body: { choice },
      });
      return unwrap(data, error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.proposal(slug, proposalId) });
      void qc.invalidateQueries({ queryKey: qk.projects.proposals(slug) });
    },
  });
}

export function useRetractVote(slug: string, proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.DELETE('/v1/projects/{slug}/proposals/{id}/vote', {
        params: { path: { slug, id: proposalId } },
      });
      return unwrap(data, error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.proposal(slug, proposalId) });
      void qc.invalidateQueries({ queryKey: qk.projects.proposals(slug) });
    },
  });
}

export function useWithdrawProposal(slug: string, proposalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.POST('/v1/projects/{slug}/proposals/{id}/withdraw', {
        params: { path: { slug, id: proposalId } },
      });
      return unwrap(data, error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.proposal(slug, proposalId) });
      void qc.invalidateQueries({ queryKey: qk.projects.proposals(slug) });
    },
  });
}
