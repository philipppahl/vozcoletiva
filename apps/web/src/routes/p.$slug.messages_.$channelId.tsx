import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';

import { ConversationHeader } from '../components/messages/ConversationHeader';
import { MessageComposer } from '../components/messages/MessageComposer';
import { MessageList } from '../components/messages/MessageList';
import { ThreadOverlay } from '../components/messages/ThreadOverlay';
import { RequireAuth } from '../components/RequireAuth';
import { useConversation, useMarkRead, useMessages, useSendMessage } from '../lib/messages';
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
  const conversation = useConversation(channelId);
  const messages = useMessages(channelId);
  const send = useSendMessage(channelId);
  const markRead = useMarkRead(channelId);
  const members = useMembers(slug);

  // Mark the channel as read on every load + when new messages arrive.
  useEffect(() => {
    const last = messages.data?.messages[messages.data.messages.length - 1];
    if (!last) return;
    markRead.mutate(last.id);
    // We only want to fire on the last message id changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.data?.messages[messages.data.messages.length - 1]?.id]);

  const mentionCandidates = useMemo(() => members.data?.members ?? [], [members.data]);

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
        onSubmit={async (body, attachments) => {
          await send.mutateAsync({ body, attachments });
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
