import { Trans } from '@lingui/macro';
import { useQueryClient } from '@tanstack/react-query';

import { discardMessage, toReplyTo, useSendMessage, useThread } from '../../lib/messages';
import type { Attachment, Conversation, Message } from '../../lib/messages/types';
import { Sheet } from '../ui/Sheet';
import type { MentionCandidate } from './MentionPopover';
import { MessageComposer } from './MessageComposer';
import { MessageRow } from './MessageRow';

interface ThreadOverlayProps {
  parentMessageId: string | null;
  conversation: Conversation | undefined;
  mentionCandidates: MentionCandidate[];
  onClose: () => void;
  projectSlug?: string;
}

export function ThreadOverlay({
  parentMessageId,
  conversation,
  mentionCandidates,
  onClose,
  projectSlug,
}: ThreadOverlayProps) {
  const open = parentMessageId !== null;
  const qc = useQueryClient();
  const thread = useThread(parentMessageId ?? undefined);
  const send = useSendMessage(conversation?.id ?? '');

  async function onPost(body: string, attachments: Attachment[]) {
    if (!parentMessageId) return;
    // Replying from the thread quotes the parent message.
    const parent = thread.data?.parent;
    await send.mutateAsync({
      body,
      attachments,
      reply_to_id: parentMessageId,
      reply_to: parent ? toReplyTo(parent) : undefined,
    });
  }

  const onRetry = (message: Message) => {
    if (!conversation) return;
    discardMessage(qc, conversation.id, message);
    send.mutate({
      body: message.body,
      reply_to_id: message.reply_to?.id,
      reply_to: message.reply_to ?? undefined,
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      side="bottom"
      title={<Trans>Thread</Trans>}
      hideTitle={false}
    >
      <div className="flex max-h-[78dvh] flex-col" style={{ minHeight: 0 }}>
        <div className="flex-1 overflow-y-auto pb-2">
          {thread.isLoading ? (
            <p className="px-4 py-4 text-sm" style={{ color: 'var(--ink-muted)' }}>
              <Trans>Loading…</Trans>
            </p>
          ) : !thread.data ? (
            <p className="px-4 py-4 text-sm" style={{ color: 'var(--no)' }}>
              <Trans>Could not load thread.</Trans>
            </p>
          ) : (
            <>
              <div className="border-b px-1 py-2" style={{ borderColor: 'var(--border)' }}>
                <MessageRow
                  message={thread.data.parent}
                  grouped={false}
                  projectSlug={projectSlug}
                />
              </div>
              <div
                className="px-1 pt-2 text-[10.5px] font-semibold uppercase"
                style={{ color: 'var(--ink-muted)', letterSpacing: 0.06 }}
              >
                <span className="px-4">
                  {thread.data.replies.length === 1 ? (
                    <Trans>1 reply</Trans>
                  ) : (
                    <Trans>{thread.data.replies.length} replies</Trans>
                  )}
                </span>
              </div>
              <div className="flex flex-col pt-1">
                {thread.data.replies.map((r, i) => {
                  const prev = thread.data!.replies[i - 1];
                  const grouped =
                    !!prev &&
                    prev.author_id === r.author_id &&
                    Date.parse(r.created_at) - Date.parse(prev.created_at) < 5 * 60_000;
                  return (
                    <MessageRow
                      key={r.id}
                      message={r}
                      grouped={grouped}
                      projectSlug={projectSlug}
                      onRetry={onRetry}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
        {conversation && (
          <MessageComposer
            mentionCandidates={mentionCandidates}
            onSubmit={onPost}
            pending={send.isPending}
          />
        )}
      </div>
    </Sheet>
  );
}
