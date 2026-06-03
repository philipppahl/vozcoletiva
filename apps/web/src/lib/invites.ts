import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@vozcoletiva/api-client';

import { apiClient } from './api';
import { completeOnboarding } from './onboarding';
import { applyPatches, rollback } from './optimistic';
import { qk, STALE } from './query';
import { toast } from './toast';

type InviteList = { invites: components['schemas']['Invite'][] };

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

export function useProjectInvites(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.projects.invites(slug) : ['projects', 'invites', '_none_'],
    staleTime: STALE.slow,
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}/invites', {
        params: { path: { slug: slug ?? '' } },
      });
      return unwrap(data, error);
    },
  });
}

export interface IssueInviteInput {
  slug: string;
  role: 'member' | 'observer';
  expiresInDays?: number;
  maxUses?: number;
  note?: string;
}

export function useIssueInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IssueInviteInput) => {
      const { data, error } = await apiClient.POST('/v1/projects/{slug}/invites', {
        params: { path: { slug: input.slug } },
        body: {
          role: input.role,
          ...(input.expiresInDays !== undefined && {
            expires_in_days: input.expiresInDays,
          }),
          ...(input.maxUses !== undefined && { max_uses: input.maxUses }),
          ...(input.note !== undefined && { note: input.note }),
        },
      });
      return unwrap(data, error);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: qk.projects.invites(vars.slug) });
    },
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { slug: string; inviteId: string }) => {
      const { data, error } = await apiClient.DELETE('/v1/projects/{slug}/invites/{inviteId}', {
        params: { path: { slug: params.slug, inviteId: params.inviteId } },
      });
      return unwrap(data, error);
    },
    onMutate: (params: { slug: string; inviteId: string }) =>
      applyPatches(qc, [
        {
          key: qk.projects.invites(params.slug),
          update: (l?: InviteList) =>
            l ? { ...l, invites: l.invites.filter((i) => i.id !== params.inviteId) } : l,
        },
      ]),
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Couldn’t revoke the invite. Please try again.');
    },
    onSettled: (_d, _e, vars) => {
      void qc.invalidateQueries({ queryKey: qk.projects.invites(vars.slug) });
    },
  });
}

export function useInviteByToken(token: string | undefined) {
  return useQuery({
    queryKey: token ? qk.invites.byToken(token) : ['invites', 'by-token', '_none_'],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/invites/{token}', {
        params: { path: { token: token ?? '' } },
      });
      return unwrap(data, error);
    },
  });
}

export function useInviteByCode(code: string | undefined) {
  return useQuery({
    queryKey: code ? qk.invites.byCode(code) : ['invites', 'by-code', '_none_'],
    enabled: !!code,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/invites/by-code/{code}', {
        params: { path: { code: code ?? '' } },
      });
      return unwrap(data, error);
    },
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await apiClient.POST('/v1/invites/{token}/accept', {
        params: { path: { token } },
      });
      return unwrap(data, error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.list() });
      completeOnboarding();
    },
  });
}

export function useAcceptInviteByCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await apiClient.POST('/v1/invites/by-code/{code}/accept', {
        params: { path: { code } },
      });
      return unwrap(data, error);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.list() });
      completeOnboarding();
    },
  });
}
