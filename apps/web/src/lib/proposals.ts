import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './api';
import { applyPatches, rollback } from './optimistic';
import type {
  ExtendedProposal,
  ExtendedProposalListResponse,
  ProposalKind,
  VotingRule,
} from './proposals/types';
import { applyRetract, applyVote } from './proposals/voteOptimistic';
import { qk } from './query';
import { toast } from './toast';

function mapInList(
  list: ExtendedProposalListResponse | undefined,
  id: string,
  fn: (p: ExtendedProposal) => ExtendedProposal,
): ExtendedProposalListResponse | undefined {
  if (!list) return list;
  return { ...list, proposals: list.proposals.map((p) => (p.id === id ? fn(p) : p)) };
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

export function useProposals(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.projects.proposals(slug) : ['projects', 'proposals', '_none_'],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}/proposals', {
        params: { path: { slug: slug ?? '' } },
      });
      return unwrap(data, error) as unknown as ExtendedProposalListResponse;
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
      return unwrap(data, error) as unknown as ExtendedProposal;
    },
    refetchOnWindowFocus: true,
    // While voting is open, refetch every 5s so the tally feels live without
    // needing a WebSocket. Real-time arrives in the chat slice.
    refetchInterval: (q) => (q.state.data?.status === 'voting' ? 5_000 : false),
  });
}

export function useProposalTree(slug: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: slug && id ? qk.projects.proposalTree(slug, id) : ['projects', 'tree', '_none_'],
    enabled: !!slug && !!id,
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        // The tree endpoint is mock-only this slice. Using a fetch-style cast
        // because the OpenAPI spec hasn't been regenerated yet.
        '/v1/projects/{slug}/proposals/{id}/tree' as unknown as '/v1/projects/{slug}/proposals/{id}',
        { params: { path: { slug: slug ?? '', id: id ?? '' } } },
      );
      return unwrap(data, error) as unknown as ExtendedProposalListResponse;
    },
    refetchOnWindowFocus: true,
  });
}

export interface CreateProposalInput {
  slug: string;
  title: string;
  body: string;
  voting_rule: VotingRule;
  ends_at: string; // ISO
  quorum?: number;
  /** Set to create a fork. Voting rule + quorum + ends_at are inherited from
   *  the root server-side; whatever you pass here is ignored when parent_id
   *  is set. */
  parent_id?: string;
  /** Decision (default) or Document. Inherited from the root for forks. */
  proposal_kind?: ProposalKind;
  /** Only valid when proposal_kind === 'document'. Stable identifier + display
   *  name for the document this deliberation targets. */
  document_name?: string;
  /** Optional on POST. Server falls back to the project's default category. */
  category_id?: string;
  /** Lightweight option labels — 2+ turns a decision into a single-select
   *  multi-option vote (a question + one option per label). */
  options?: string[];
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProposalInput) => {
      // Extra fields aren't in the OpenAPI spec yet; openapi-fetch passes
      // them through and the mock consumes them. The cast is removed once
      // the spec is regenerated. See decisions 0002, 0004, 0005.
      const body = {
        title: input.title,
        body: input.body,
        voting_rule: input.voting_rule,
        ends_at: input.ends_at,
        ...(input.quorum !== undefined && { quorum: input.quorum }),
        ...(input.parent_id && { parent_id: input.parent_id }),
        ...(input.proposal_kind && { proposal_kind: input.proposal_kind }),
        ...(input.document_name && { document_name: input.document_name }),
        ...(input.category_id && { category_id: input.category_id }),
        ...(input.options && input.options.length > 0 && { options: input.options }),
      };
      const { data, error } = await apiClient.POST('/v1/projects/{slug}/proposals', {
        params: { path: { slug: input.slug } },
        body: body as unknown as {
          title: string;
          body: string;
          voting_mode: 'simple_majority' | 'qualified_two_thirds';
          ends_at: string;
        },
      });
      return unwrap(data, error) as unknown as ExtendedProposal;
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: qk.projects.proposals(vars.slug) });
      if (vars.parent_id) {
        void qc.invalidateQueries({
          queryKey: qk.projects.proposalTree(vars.slug, vars.parent_id),
        });
      }
    },
  });
}

/** Cast a vote in a deliberation. `proposalId` is any proposal in the tree
 *  (the server resolves to the root). `choice` is the picked alternative's
 *  proposal id, or VOTE_NONE / VOTE_ABSTAIN. */
function invalidateProposal(
  qc: ReturnType<typeof useQueryClient>,
  slug: string,
  proposalId: string,
) {
  void qc.invalidateQueries({ queryKey: qk.projects.proposal(slug, proposalId) });
  void qc.invalidateQueries({ queryKey: qk.projects.proposals(slug) });
}

export function useCastVote(slug: string, proposalId: string) {
  const qc = useQueryClient();
  const detailKey = qk.projects.proposal(slug, proposalId);
  const listKey = qk.projects.proposals(slug);
  return useMutation({
    mutationFn: async (choice: string) => {
      const { data, error } = await apiClient.POST('/v1/projects/{slug}/proposals/{id}/vote', {
        params: { path: { slug, id: proposalId } },
        body: { choice } as unknown as { choice: 'yes' | 'no' | 'abstain' },
      });
      return unwrap(data, error);
    },
    onMutate: (choice: string) =>
      applyPatches(qc, [
        { key: detailKey, update: (p?: ExtendedProposal) => (p ? applyVote(p, choice) : p) },
        { key: listKey, update: (l) => mapInList(l, proposalId, (p) => applyVote(p, choice)) },
      ]),
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Your vote didn’t go through. Please try again.');
    },
    onSettled: () => invalidateProposal(qc, slug, proposalId),
  });
}

export function useRetractVote(slug: string, proposalId: string) {
  const qc = useQueryClient();
  const detailKey = qk.projects.proposal(slug, proposalId);
  const listKey = qk.projects.proposals(slug);
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.DELETE('/v1/projects/{slug}/proposals/{id}/vote', {
        params: { path: { slug, id: proposalId } },
      });
      return unwrap(data, error);
    },
    onMutate: () =>
      applyPatches(qc, [
        { key: detailKey, update: (p?: ExtendedProposal) => (p ? applyRetract(p) : p) },
        { key: listKey, update: (l) => mapInList(l, proposalId, (p) => applyRetract(p)) },
      ]),
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Couldn’t retract your vote. Please try again.');
    },
    onSettled: () => invalidateProposal(qc, slug, proposalId),
  });
}

export function useWithdrawProposal(slug: string, proposalId: string) {
  const qc = useQueryClient();
  const detailKey = qk.projects.proposal(slug, proposalId);
  const listKey = qk.projects.proposals(slug);
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.POST('/v1/projects/{slug}/proposals/{id}/withdraw', {
        params: { path: { slug, id: proposalId } },
      });
      return unwrap(data, error);
    },
    onMutate: () =>
      applyPatches(qc, [
        {
          key: detailKey,
          update: (p?: ExtendedProposal) => (p ? { ...p, status: 'withdrawn' } : p),
        },
        {
          key: listKey,
          update: (l) => mapInList(l, proposalId, (p) => ({ ...p, status: 'withdrawn' })),
        },
      ]),
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Couldn’t withdraw the proposal. Please try again.');
    },
    onSettled: () => invalidateProposal(qc, slug, proposalId),
  });
}
