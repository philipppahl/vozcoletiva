import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';

import { ConversationHeader } from '../components/messages/ConversationHeader';
import { MessageComposer } from '../components/messages/MessageComposer';
import { MessageList } from '../components/messages/MessageList';
import { ThreadOverlay } from '../components/messages/ThreadOverlay';
import { RequireAuth } from '../components/RequireAuth';
import { useAuth } from '../lib/auth/hooks';
import {
  discardMessage,
  useConversation,
  useMarkRead,
  useMessages,
  useSendMessage,
} from '../lib/messages';
import type { Message } from '../lib/messages/types';

interface DmSearch {
  thread?: string;
}

export const Route = createFileRoute('/dms_/$id')({
  component: () => (
    <RequireAuth>
      <DmDetailPage />
    </RequireAuth>
  ),
  validateSearch: (search): DmSearch => ({
    thread: typeof search.thread === 'string' ? search.thread : undefined,
  }),
});

function DmDetailPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const conversation = useConversation(id);
  const messages = useMessages(id);
  const send = useSendMessage(id);
  const markRead = useMarkRead(id);
  const { session } = useAuth();

  const onRetry = (message: Message) => {
    discardMessage(qc, id, message);
    send.mutate({ body: message.body, parent_message_id: message.parent_message_id ?? undefined });
  };

  useEffect(() => {
    const last = messages.data?.messages[messages.data.messages.length - 1];
    if (!last) return;
    markRead.mutate(last.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.data?.messages[messages.data.messages.length - 1]?.id]);

  // Mention candidates for a DM = the two participants (less the viewer
  // self-mention isn't useful but harmless).
  const mentionCandidates = useMemo(() => {
    if (conversation.data?.kind !== 'dm') return [];
    return conversation.data.participants
      .filter((p) => p.user_id !== session?.userId)
      .map((p) => ({ user_id: p.user_id, display_name: p.display_name }));
  }, [conversation.data, session?.userId]);

  // Avatars: the peer from the participants, the viewer from the live session.
  const avatarFor = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    if (conversation.data?.kind === 'dm') {
      for (const p of conversation.data.participants) map.set(p.user_id, p.avatar_url);
    }
    if (session?.userId) map.set(session.userId, session.avatarUrl);
    return (userId: string) => map.get(userId);
  }, [conversation.data, session?.userId, session?.avatarUrl]);

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <ConversationHeader
        conversation={conversation.data}
        onBack={() =>
          router.history.canGoBack() ? router.history.back() : navigate({ to: '/dms' })
        }
      />
      <MessageList
        messages={messages.data?.messages ?? []}
        onRetry={onRetry}
        avatarFor={avatarFor}
        onOpenThread={(messageId) =>
          void navigate({
            to: '/dms/$id',
            params: { id },
            search: { thread: messageId },
          })
        }
      />
      <MessageComposer
        mentionCandidates={mentionCandidates}
        onSubmit={async (body, attachments) => {
          await send.mutateAsync({ body, attachments });
        }}
        pending={send.isPending}
      />
      <ThreadOverlay
        parentMessageId={search.thread ?? null}
        conversation={conversation.data}
        mentionCandidates={mentionCandidates}
        onClose={() =>
          void navigate({
            to: '/dms/$id',
            params: { id },
            search: { thread: undefined },
          })
        }
      />
    </div>
  );
}
