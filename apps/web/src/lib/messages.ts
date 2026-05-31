import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiClient } from './api';
import type {
  Attachment,
  ChannelListResponse,
  Conversation,
  DmConversation,
  DmListResponse,
  Message,
  MessageListResponse,
  ThreadResponse,
} from './messages/types';
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

// Channels, DMs, messages, threads, and reads all hit the real API via
// `apiClient`. Only inbox + search remain on the comms-mock. See decision 0020.

// ── list queries ───────────────────────────────────────────────────────────

export function useChannels(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.projects.channels(slug) : ['channels', '_none_'],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/projects/{slug}/channels', {
        params: { path: { slug: slug ?? '' } },
      });
      return unwrap(data, error) as unknown as ChannelListResponse;
    },
    refetchOnWindowFocus: true,
  });
}

export function useDms() {
  return useQuery({
    queryKey: qk.chat.dms(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/dms');
      return unwrap(data, error) as unknown as DmListResponse;
    },
    refetchOnWindowFocus: true,
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.chat.conversation(id) : ['conversation', '_none_'],
    enabled: !!id,
    // The real API types this as a channel; a DM comes through the mock
    // passthrough as the broader `Conversation` union.
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/conversations/{id}', {
        params: { path: { id: id ?? '' } },
      });
      return unwrap(data, error) as unknown as Conversation;
    },
    refetchOnWindowFocus: true,
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: conversationId ? qk.chat.messages(conversationId) : ['messages', '_none_'],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/conversations/{id}/messages', {
        params: { path: { id: conversationId ?? '' } },
      });
      return unwrap(data, error) as unknown as MessageListResponse;
    },
  });
}

export function useThread(parentMessageId: string | undefined) {
  return useQuery({
    queryKey: parentMessageId ? qk.chat.thread(parentMessageId) : ['thread', '_none_'],
    enabled: !!parentMessageId,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/messages/{id}/thread', {
        params: { path: { id: parentMessageId ?? '' } },
      });
      return unwrap(data, error) as unknown as ThreadResponse;
    },
  });
}

// ── mutations ──────────────────────────────────────────────────────────────

export interface SendMessageInput {
  body: string;
  attachments?: Attachment[];
  parent_message_id?: string;
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const { data, error } = await apiClient.POST('/v1/conversations/{id}/messages', {
        params: { path: { id: conversationId } },
        body: { body: input.body, parent_message_id: input.parent_message_id ?? null },
      });
      return unwrap(data, error) as unknown as Message;
    },
    onSuccess: (msg) => {
      // The bus will also fire and merge into the cache via the subscriber;
      // but the optimistic merge ensures the composer feels instant.
      mergeMessage(qc, msg);
    },
  });
}

export function useMarkRead(conversationId: string) {
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await apiClient.POST('/v1/conversations/{id}/read', {
        params: { path: { id: conversationId } },
        body: { message_id: messageId },
      });
      return unwrap(data, error);
    },
  });
}

export function useStartDm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await apiClient.POST('/v1/dms', { body: { user_id: userId } });
      return unwrap(data, error) as unknown as DmConversation;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.chat.dms() });
    },
  });
}

// ── cache merge helpers ────────────────────────────────────────────────────

function mergeMessage(qc: QueryClient, message: Message) {
  // Top-level message: prepend to the messages cache + bump the channel/DM
  // list's last-message preview.
  if (message.parent_message_id) {
    qc.setQueryData<ThreadResponse | undefined>(
      qk.chat.thread(message.parent_message_id),
      (prev) => {
        if (!prev) return prev;
        if (prev.replies.some((r) => r.id === message.id)) return prev;
        return { ...prev, replies: [...prev.replies, message] };
      },
    );
    // The parent's reply_count needs bumping in the messages list too.
    qc.setQueryData<MessageListResponse | undefined>(
      qk.chat.messages(message.conversation_id),
      (prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((m) =>
                m.id === message.parent_message_id
                  ? {
                      ...m,
                      reply_count: m.reply_count + 1,
                      last_reply_at: message.created_at,
                    }
                  : m,
              ),
            }
          : prev,
    );
  } else {
    qc.setQueryData<MessageListResponse | undefined>(
      qk.chat.messages(message.conversation_id),
      (prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => m.id === message.id)) return prev;
        return { ...prev, messages: [...prev.messages, message] };
      },
    );
  }
  // Lists become stale (last-message / unread counts).
  void qc.invalidateQueries({ queryKey: ['projects'], exact: false });
  void qc.invalidateQueries({ queryKey: qk.chat.dms() });
}

// ── bus subscription ───────────────────────────────────────────────────────

/**
 * Subscribes the React Query cache to the mock message bus. Mount once near
 * the app root in mock mode; the subscriber merges new messages so any open
 * conversation reflects them without a refetch.
 */
export function useMessageBusBridge() {
  const qc = useQueryClient();
  useEffect(() => {
    if (import.meta.env.VITE_USE_MOCKS !== '1') return undefined;
    let cleanup = () => {};
    void import('../mocks/messageBus').then((mod) => {
      cleanup = mod.subscribe((event) => {
        if (event.type === 'conversation.message-created') {
          // The mock event uses snake-cased keys via toMessageDto; convert
          // by re-routing the cache merge through the proper DTO. The
          // simplest: invalidate. Cheap and correct.
          void qc.invalidateQueries({
            queryKey: qk.chat.messages(event.message.conversationId),
          });
          if (event.message.parentMessageId) {
            void qc.invalidateQueries({
              queryKey: qk.chat.thread(event.message.parentMessageId),
            });
          }
          void qc.invalidateQueries({ queryKey: qk.chat.dms() });
          void qc.invalidateQueries({ queryKey: ['projects'], exact: false });
        }
      });
    });
    return () => cleanup();
  }, [qc]);
}
