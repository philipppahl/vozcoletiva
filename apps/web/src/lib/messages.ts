import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiClient } from './api';
import { useAuthStore } from './auth/store';
import type {
  Attachment,
  ChannelListResponse,
  Conversation,
  DmConversation,
  DmListResponse,
  Message,
  MessageListResponse,
  ReplyTo,
  ThreadResponse,
} from './messages/types';
import { tempId } from './optimistic';
import { qk } from './query';
import { useRealtimeStore } from './realtime';

// Re-export so existing callers keep importing it from `./messages`.
export { toReplyTo } from './messages/types';

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

// Live delivery is the WebSocket realtime client (decision 0028); polling is the
// fallback (0027). When the socket is up we poll on a slow safety-net interval
// (catches a dropped signal); when it's down we poll fast for near-live updates.
// TanStack pauses interval refetches when the tab is hidden, either way.
const CHAT_POLL_MS = 4000;
const CHAT_POLL_FALLBACK_MS = 20000;
const LIST_POLL_MS = 8000;
const LIST_POLL_FALLBACK_MS = 30000;

function chatPoll(connected: boolean) {
  return connected ? CHAT_POLL_FALLBACK_MS : CHAT_POLL_MS;
}
function listPoll(connected: boolean) {
  return connected ? LIST_POLL_FALLBACK_MS : LIST_POLL_MS;
}

export function useChannels(slug: string | undefined) {
  const connected = useRealtimeStore((s) => s.connected);
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
    refetchInterval: listPoll(connected),
  });
}

export function useDms() {
  const connected = useRealtimeStore((s) => s.connected);
  return useQuery({
    queryKey: qk.chat.dms(),
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/dms');
      return unwrap(data, error) as unknown as DmListResponse;
    },
    refetchOnWindowFocus: true,
    refetchInterval: listPoll(connected),
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
  const qc = useQueryClient();
  const connected = useRealtimeStore((s) => s.connected);
  const key = conversationId ? qk.chat.messages(conversationId) : ['messages', '_none_'];
  return useQuery({
    queryKey: key,
    enabled: !!conversationId,
    refetchInterval: chatPoll(connected),
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/conversations/{id}/messages', {
        params: { path: { id: conversationId ?? '' } },
      });
      const server = unwrap(data, error) as unknown as MessageListResponse;
      // Keep in-flight / failed optimistic messages (client-only temp ids) so a
      // background poll doesn't wipe a pending bubble or a failed-retry.
      const prev = qc.getQueryData<MessageListResponse>(key);
      const pending = (prev?.messages ?? []).filter(
        (m) => m._optimistic && !server.messages.some((s) => s.id === m.id),
      );
      return pending.length ? { ...server, messages: [...server.messages, ...pending] } : server;
    },
  });
}

export function useThread(parentMessageId: string | undefined) {
  const qc = useQueryClient();
  const connected = useRealtimeStore((s) => s.connected);
  const key = parentMessageId ? qk.chat.thread(parentMessageId) : ['thread', '_none_'];
  return useQuery({
    queryKey: key,
    enabled: !!parentMessageId,
    refetchInterval: chatPoll(connected),
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/v1/messages/{id}/thread', {
        params: { path: { id: parentMessageId ?? '' } },
      });
      const server = unwrap(data, error) as unknown as ThreadResponse;
      const prev = qc.getQueryData<ThreadResponse>(key);
      const pending = (prev?.replies ?? []).filter(
        (r) => r._optimistic && !server.replies.some((s) => s.id === r.id),
      );
      return pending.length ? { ...server, replies: [...server.replies, ...pending] } : server;
    },
  });
}

// ── mutations ──────────────────────────────────────────────────────────────

export interface SendMessageInput {
  body: string;
  attachments?: Attachment[];
  /** The quoted message id (decision 0031); the reply lives inline. */
  reply_to_id?: string;
  /** The quote snapshot, for the optimistic bubble's header before the server
   *  echoes it back. */
  reply_to?: ReplyTo;
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      // Send only the fields the API needs (key + metadata, never the url).
      const attachments = (input.attachments ?? [])
        .filter((a) => a.key && !a._uploading)
        .map((a) => ({
          kind: a.kind,
          key: a.key as string,
          mime: a.mime,
          name: a.name,
          size: a.size,
          width: a.width,
          height: a.height,
          duration_ms: a.duration_ms,
        }));
      const { data, error } = await apiClient.POST('/v1/conversations/{id}/messages', {
        params: { path: { id: conversationId } },
        body: {
          body: input.body,
          reply_to_id: input.reply_to_id ?? null,
          ...(attachments.length ? { attachments } : {}),
        },
      });
      return unwrap(data, error) as unknown as Message;
    },
    // Show the bubble instantly with a pending marker.
    onMutate: (input: SendMessageInput) => {
      const session = useAuthStore.getState().session;
      const id = tempId();
      const optimistic: Message = {
        id,
        conversation_id: conversationId,
        reply_to: input.reply_to ?? null,
        author_id: session?.userId ?? '',
        author_display_name: session?.displayName ?? '',
        body: input.body,
        attachments: input.attachments ?? [],
        created_at: new Date().toISOString(),
        edited_at: null,
        reply_count: 0,
        last_reply_at: null,
        _optimistic: 'pending',
      };
      insertMessage(qc, conversationId, optimistic);
      return { tempId: id };
    },
    onSuccess: (real, _input, ctx) => {
      replaceMessage(qc, conversationId, ctx?.tempId, real);
      void qc.invalidateQueries({ queryKey: qk.chat.dms() });
      void qc.invalidateQueries({ queryKey: ['projects'], exact: false });
    },
    // Keep the bubble, mark it failed so the row can offer a retry.
    onError: (_e, input, ctx) => {
      setMessageStatus(qc, conversationId, ctx?.tempId, input.reply_to?.id, 'failed');
    },
  });
}

/** Drop a failed optimistic message (used by the retry affordance). */
export function discardMessage(
  qc: QueryClient,
  conversationId: string,
  message: Pick<Message, 'id' | 'reply_to'>,
) {
  removeMessage(qc, conversationId, message.id, message.reply_to?.id ?? null);
}

export function useMarkRead(conversationId: string, slug?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await apiClient.POST('/v1/conversations/{id}/read', {
        params: { path: { id: conversationId } },
        body: { message_id: messageId },
      });
      return unwrap(data, error);
    },
    // Clear the unread badge for this conversation immediately.
    onMutate: () => {
      qc.setQueryData<Conversation | undefined>(qk.chat.conversation(conversationId), (prev) =>
        prev ? { ...prev, unread_count: 0 } : prev,
      );
      qc.setQueryData<DmListResponse | undefined>(qk.chat.dms(), (prev) =>
        prev
          ? {
              ...prev,
              dms: prev.dms.map((d) => (d.id === conversationId ? { ...d, unread_count: 0 } : d)),
            }
          : prev,
      );
      if (slug) {
        qc.setQueryData<ChannelListResponse | undefined>(qk.projects.channels(slug), (prev) =>
          prev
            ? {
                ...prev,
                channels: prev.channels.map((c) =>
                  c.id === conversationId ? { ...c, unread_count: 0 } : c,
                ),
              }
            : prev,
        );
      }
    },
    onSettled: () => {
      // Reconcile the derived nav badges.
      void qc.invalidateQueries({ queryKey: qk.chat.dms() });
      void qc.invalidateQueries({ queryKey: ['projects'], exact: false });
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

// ── message cache helpers ──────────────────────────────────────────────────

function setMessages(
  qc: QueryClient,
  conversationId: string,
  fn: (prev: MessageListResponse) => MessageListResponse,
) {
  qc.setQueryData<MessageListResponse | undefined>(qk.chat.messages(conversationId), (prev) =>
    prev ? fn(prev) : prev,
  );
}

function setThread(
  qc: QueryClient,
  parentId: string,
  fn: (prev: ThreadResponse) => ThreadResponse,
) {
  qc.setQueryData<ThreadResponse | undefined>(qk.chat.thread(parentId), (prev) =>
    prev ? fn(prev) : prev,
  );
}

/**
 * Insert an optimistic message. Replies live inline in the main list now
 * (decision 0031); when it's a reply we also bump the quoted message's
 * `reply_count` and mirror it into an open thread view.
 */
function insertMessage(qc: QueryClient, conversationId: string, msg: Message) {
  setMessages(qc, conversationId, (prev) => ({
    ...prev,
    messages: [
      ...prev.messages.map((m) =>
        m.id === msg.reply_to?.id
          ? { ...m, reply_count: m.reply_count + 1, last_reply_at: msg.created_at }
          : m,
      ),
      msg,
    ],
  }));
  if (msg.reply_to) {
    setThread(qc, msg.reply_to.id, (prev) => ({ ...prev, replies: [...prev.replies, msg] }));
  }
}

/** Replace the temp message (by id) with the server's real message. */
function replaceMessage(
  qc: QueryClient,
  conversationId: string,
  tempIdValue: string | undefined,
  real: Message,
) {
  if (!tempIdValue) return;
  setMessages(qc, conversationId, (prev) => ({
    ...prev,
    messages: prev.messages.map((m) => (m.id === tempIdValue ? real : m)),
  }));
  if (real.reply_to) {
    setThread(qc, real.reply_to.id, (prev) => ({
      ...prev,
      replies: prev.replies.map((r) => (r.id === tempIdValue ? real : r)),
    }));
  }
}

function setMessageStatus(
  qc: QueryClient,
  conversationId: string,
  id: string | undefined,
  parentId: string | undefined,
  status: Message['_optimistic'],
) {
  if (!id) return;
  setMessages(qc, conversationId, (prev) => ({
    ...prev,
    messages: prev.messages.map((m) => (m.id === id ? { ...m, _optimistic: status } : m)),
  }));
  if (parentId) {
    setThread(qc, parentId, (prev) => ({
      ...prev,
      replies: prev.replies.map((r) => (r.id === id ? { ...r, _optimistic: status } : r)),
    }));
  }
}

function removeMessage(
  qc: QueryClient,
  conversationId: string,
  id: string,
  parentId: string | null,
) {
  setMessages(qc, conversationId, (prev) => ({
    ...prev,
    messages: prev.messages
      .filter((m) => m.id !== id)
      .map((m) =>
        parentId && m.id === parentId ? { ...m, reply_count: Math.max(0, m.reply_count - 1) } : m,
      ),
  }));
  if (parentId) {
    setThread(qc, parentId, (prev) => ({
      ...prev,
      replies: prev.replies.filter((r) => r.id !== id),
    }));
  }
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
