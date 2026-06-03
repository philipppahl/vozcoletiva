import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@vozcoletiva/api-client';

import { apiClient } from './api';
import { useAuthStore } from './auth/store';
import { applyReactionToggle } from './messages/types';
import { applyPatches, rollback, tempId } from './optimistic';
import { qk } from './query';
import { toast } from './toast';

type Comment = components['schemas']['Comment'];
type CommentReplyTo = components['schemas']['CommentReplyTo'];
interface CommentList {
  comments: Comment[];
}

/** Quote-reply target captured by the composer (decision 0033). */
export interface CommentReplyTarget {
  id: string;
  author_display_name: string;
  preview: string;
}

export interface CreateCommentInput {
  body: string;
  replyTo?: CommentReplyTarget | null;
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

function mapComment(
  list: CommentList | undefined,
  id: string,
  fn: (c: Comment) => Comment,
): CommentList | undefined {
  if (!list) return list;
  return { ...list, comments: list.comments.map((c) => (c.id === id ? fn(c) : c)) };
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
  const key = qk.projects.comments(slug, proposalId);
  return useMutation({
    mutationFn: async (input: CreateCommentInput) => {
      const { data, error } = await apiClient.POST('/v1/projects/{slug}/proposals/{id}/comments', {
        params: { path: { slug, id: proposalId } },
        body: { body: input.body, reply_to_id: input.replyTo?.id ?? null },
      });
      return unwrap(data, error);
    },
    onMutate: (input: CreateCommentInput) => {
      const s = useAuthStore.getState().session;
      const replyTo: CommentReplyTo | null = input.replyTo
        ? {
            id: input.replyTo.id,
            author_display_name: input.replyTo.author_display_name,
            preview: input.replyTo.preview,
          }
        : null;
      const optimistic: Comment = {
        id: tempId(),
        proposal_id: proposalId,
        author_id: s?.userId ?? '',
        author_display_name: s?.displayName ?? '',
        body: input.body,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted_at: null,
        deleted_by: null,
        reply_to: replyTo,
        reactions: [],
      };
      return applyPatches(qc, [
        {
          key,
          update: (l?: CommentList) => (l ? { ...l, comments: [...l.comments, optimistic] } : l),
        },
      ]);
    },
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Couldn’t post your comment. Please try again.');
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

export interface ToggleCommentReactionInput {
  commentId: string;
  emoji: string;
  active: boolean;
}

export function useToggleCommentReaction(slug: string, proposalId: string) {
  const qc = useQueryClient();
  const key = qk.projects.comments(slug, proposalId);
  return useMutation({
    mutationFn: async (input: ToggleCommentReactionInput) => {
      const { data, error } = await apiClient.PUT(
        '/v1/projects/{slug}/proposals/{id}/comments/{commentId}/reactions',
        {
          params: { path: { slug, id: proposalId, commentId: input.commentId } },
          body: { emoji: input.emoji, active: input.active },
        },
      );
      return unwrap(data, error);
    },
    onMutate: (input: ToggleCommentReactionInput) =>
      applyPatches(qc, [
        {
          key,
          update: (l?: CommentList) =>
            mapComment(l, input.commentId, (c) => ({
              ...c,
              reactions: applyReactionToggle(c.reactions, input.emoji, input.active),
            })),
        },
      ]),
    onSuccess: (res, input) => {
      // Replace the optimistic tallies with the server's authoritative set.
      qc.setQueryData<CommentList | undefined>(key, (l) =>
        mapComment(l, input.commentId, (c) => ({ ...c, reactions: res.reactions })),
      );
    },
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Couldn’t react. Please try again.');
    },
  });
}

export function useEditComment(slug: string, proposalId: string) {
  const qc = useQueryClient();
  const key = qk.projects.comments(slug, proposalId);
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
    onMutate: (vars: { commentId: string; body: string }) =>
      applyPatches(qc, [
        {
          key,
          update: (l?: CommentList) =>
            mapComment(l, vars.commentId, (c) => ({
              ...c,
              body: vars.body,
              edited_at: new Date().toISOString(),
            })),
        },
      ]),
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Couldn’t save the edit. Please try again.');
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteComment(slug: string, proposalId: string) {
  const qc = useQueryClient();
  const key = qk.projects.comments(slug, proposalId);
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
    onMutate: (commentId: string) => {
      const s = useAuthStore.getState().session;
      return applyPatches(qc, [
        {
          key,
          update: (l?: CommentList) =>
            mapComment(l, commentId, (c) => ({
              ...c,
              body: null,
              deleted_at: new Date().toISOString(),
              deleted_by: s?.userId ?? null,
            })),
        },
      ]);
    },
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Couldn’t delete the comment. Please try again.');
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });
}
