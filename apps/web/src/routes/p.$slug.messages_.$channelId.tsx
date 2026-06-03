import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { ConversationHeader } from '../components/messages/ConversationHeader';
import { MessageComposer } from '../components/messages/MessageComposer';
import { MessageList } from '../components/messages/MessageList';
import { ThreadOverlay } from '../components/messages/ThreadOverlay';
import { RequireAuth } from '../components/RequireAuth';
import {
  discardMessage,
  toReplyTo,
  useConversation,
  useMarkRead,
  useMessages,
  useSendMessage,
  useToggleReaction,
} from '../lib/messages';
import type { Message } from '../lib/messages/types';
import { useMembers } from '../lib/projects';

interface ChannelSearch {
  thread?: string;
}

export const Route = createFileRoute('/p/$slug/messages_/$channelId')({
  component: () => (
    <RequireAuth>
      <ChannelDetailPage />
    </RequireAuth>
  ),
  validateSearch: (search): ChannelSearch => ({
    thread: typeof search.thread === 'string' ? search.thread : undefined,
  }),
});

function ChannelDetailPage() {
  const { slug, channelId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const conversation = useConversation(channelId);
  const messages = useMessages(channelId);
  const send = useSendMessage(channelId);
  const markRead = useMarkRead(channelId, slug);
  const members = useMembers(slug);
  const toggleReaction = useToggleReaction(channelId);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);

  const onRetry = (message: Message) => {
    discardMessage(qc, channelId, message);
    send.mutate({
      body: message.body,
      reply_to_id: message.reply_to?.id,
      reply_to: message.reply_to ?? undefined,
    });
  };

  // Mark the channel as read on every load + when new messages arrive.
  useEffect(() => {
    const last = messages.data?.messages[messages.data.messages.length - 1];
    if (!last) return;
    markRead.mutate(last.id);
    // We only want to fire on the last message id changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.data?.messages[messages.data.messages.length - 1]?.id]);

  // Only members with a handle can be @mentioned (the handle goes into the body).
  const mentionCandidates = useMemo(
    () =>
      (members.data?.members ?? [])
        .filter((m) => !!m.handle)
        .map((m) => ({
          user_id: m.user_id,
          display_name: m.display_name,
          handle: m.handle as string,
        })),
    [members.data],
  );
  const avatarFor = useMemo(() => {
    const map = new Map((members.data?.members ?? []).map((m) => [m.user_id, m.avatar_url]));
    return (userId: string) => map.get(userId);
  }, [members.data]);

  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <ConversationHeader
        conversation={conversation.data}
        onBack={() => void navigate({ to: '/p/$slug/messages', params: { slug } })}
      />
      <MessageList
        messages={messages.data?.messages ?? []}
        projectSlug={slug}
        onRetry={onRetry}
        avatarFor={avatarFor}
        onReply={setReplyTarget}
        onToggleReaction={(messageId, emoji, active) =>
          toggleReaction.mutate({ messageId, emoji, active })
        }
        onOpenThread={(id) =>
          void navigate({
            to: '/p/$slug/messages/$channelId',
            params: { slug, channelId },
            search: { thread: id },
          })
        }
      />
      <MessageComposer
        mentionCandidates={mentionCandidates}
        replyingTo={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
        onSubmit={async (body, attachments) => {
          await send.mutateAsync({
            body,
            attachments,
            reply_to_id: replyTarget?.id,
            reply_to: replyTarget ? toReplyTo(replyTarget) : undefined,
          });
          setReplyTarget(null);
        }}
        pending={send.isPending}
      />
      <ThreadOverlay
        parentMessageId={search.thread ?? null}
        conversation={conversation.data}
        mentionCandidates={mentionCandidates}
        projectSlug={slug}
        onClose={() =>
          void navigate({
            to: '/p/$slug/messages/$channelId',
            params: { slug, channelId },
            search: { thread: undefined },
          })
        }
      />
    </div>
  );
}
