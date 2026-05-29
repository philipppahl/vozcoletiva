import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

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

// All endpoints are mock-only this slice. We bypass the openapi-fetch type
// system with a tiny `mockGet`/`mockPost` helper that falls back to native
// fetch for these unknown paths. Real BE wire-up regenerates the OpenAPI
// schema and we delete this shim.

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

async function mockPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/v1${path}`, {
    method: 'POST',
    headers: { authorization: 'Bearer mock', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(errBody.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

// ── list queries ───────────────────────────────────────────────────────────

export function useChannels(slug: string | undefined) {
  return useQuery({
    queryKey: slug ? qk.projects.channels(slug) : ['channels', '_none_'],
    enabled: !!slug,
    queryFn: () =>
      mockGet<ChannelListResponse>(`/projects/${encodeURIComponent(slug ?? '')}/channels`),
    refetchOnWindowFocus: true,
  });
}

export function useDms() {
  return useQuery({
    queryKey: qk.chat.dms(),
    queryFn: () => mockGet<DmListResponse>('/dms'),
    refetchOnWindowFocus: true,
  });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.chat.conversation(id) : ['conversation', '_none_'],
    enabled: !!id,
    queryFn: () => mockGet<Conversation>(`/conversations/${encodeURIComponent(id ?? '')}`),
    refetchOnWindowFocus: true,
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: conversationId ? qk.chat.messages(conversationId) : ['messages', '_none_'],
    enabled: !!conversationId,
    queryFn: () =>
      mockGet<MessageListResponse>(
        `/conversations/${encodeURIComponent(conversationId ?? '')}/messages?limit=100`,
      ),
  });
}

export function useThread(parentMessageId: string | undefined) {
  return useQuery({
    queryKey: parentMessageId ? qk.chat.thread(parentMessageId) : ['thread', '_none_'],
    enabled: !!parentMessageId,
    queryFn: () =>
      mockGet<ThreadResponse>(`/messages/${encodeURIComponent(parentMessageId ?? '')}/thread`),
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
    mutationFn: (input: SendMessageInput) =>
      mockPost<Message>(`/conversations/${encodeURIComponent(conversationId)}/messages`, input),
    onSuccess: (msg) => {
      // The bus will also fire and merge into the cache via the subscriber;
      // but the optimistic merge ensures the composer feels instant.
      mergeMessage(qc, msg);
    },
  });
}

export function useMarkRead(conversationId: string) {
  return useMutation({
    mutationFn: (messageId: string) =>
      mockPost<{ ok: true }>(`/conversations/${encodeURIComponent(conversationId)}/read`, {
        message_id: messageId,
      }),
  });
}

export function useStartDm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => mockPost<DmConversation>('/dms', { user_id: userId }),
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
