import { Trans } from '@lingui/macro';

import { useAuth } from '../../lib/auth/hooks';
import type { Message } from '../../lib/messages/types';
import { RelativeTime } from '../RelativeTime';
import { Avatar } from '../shell/Avatar';
import { AttachmentBlock } from './DocCard';
import { MessageMarkdown } from './messageMarkdown';

interface MessageRowProps {
  message: Message;
  /** Grouped with the previous row (same author, < 5 min) — hides avatar/name. */
  grouped: boolean;
  /** Last message of a same-author run — carries the time + the bubble "tail". */
  tail?: boolean;
  /** When set, the "N replies" affordance opens this thread overlay. */
  onOpenThread?: (messageId: string) => void;
  /** Optional slug, threaded through the markdown renderer for @mentions. */
  projectSlug?: string;
  /** Retry a failed optimistic send. */
  onRetry?: (message: Message) => void;
  /** The author's avatar URL, if any (else initials). */
  avatarUrl?: string | null;
}

/**
 * One chat message as a messenger bubble: the viewer's own messages align right
 * in an accent bubble (no avatar); everyone else aligns left in a surface bubble
 * with their avatar. Consecutive same-author messages group; the last of a run
 * shows the time + a subtle tail.
 */
export function MessageRow({
  message,
  grouped,
  tail = true,
  onOpenThread,
  projectSlug,
  onRetry,
  avatarUrl,
}: MessageRowProps) {
  const { session } = useAuth();
  const own = !!session && message.author_id === session.userId;
  const pending = message._optimistic === 'pending';
  const failed = message._optimistic === 'failed';
  // Channels (projectSlug set) name the sender above others' bubbles; DMs don't.
  const showName = !own && !grouped && !!projectSlug;
  const hasText = !!message.body;
  // Media-only messages drop the coloured bubble — the attachment carries its
  // own frame (an indigo wrapper around a photo looks heavy).
  const mediaOnly = !hasText && message.attachments.length > 0;
  // Telegram-style: for a pure-text bubble the time + status sit inline after
  // the text (flowing onto the last line when it fits), so messages pack
  // tighter. Bubbles with attachments keep the time on a row below.
  const inlineTime = hasText && message.attachments.length === 0;
  const metaColor = own ? 'rgba(255,255,255,0.72)' : 'var(--ink-muted)';

  return (
    <div
      className="flex w-full px-3"
      style={{ justifyContent: own ? 'flex-end' : 'flex-start', paddingTop: grouped ? 2 : 10 }}
    >
      {!own && (
        <div style={{ width: 28, marginRight: 8, flexShrink: 0 }}>
          {grouped ? null : (
            <Avatar displayName={message.author_display_name} size={28} imageUrl={avatarUrl} />
          )}
        </div>
      )}

      <div
        className="flex min-w-0 flex-col"
        style={{ maxWidth: '76%', alignItems: own ? 'flex-end' : 'flex-start' }}
      >
        {showName && (
          <div
            className="mb-0.5 px-1 text-[11.5px] font-semibold"
            style={{ color: 'var(--ink-soft)' }}
          >
            {message.author_display_name}
          </div>
        )}

        <div
          style={{
            background: mediaOnly ? 'transparent' : own ? 'var(--accent)' : 'var(--surface-2)',
            color: own ? 'var(--accent-ink)' : 'var(--ink)',
            borderRadius: 18,
            borderBottomRightRadius: !mediaOnly && own && tail ? 6 : 18,
            borderBottomLeftRadius: !mediaOnly && !own && tail ? 6 : 18,
            padding: mediaOnly ? 0 : hasText ? '7px 11px' : 4,
            opacity: pending ? 0.75 : 1,
            maxWidth: '100%',
          }}
        >
          {hasText && <MessageMarkdown body={message.body} projectSlug={projectSlug} own={own} />}
          {inlineTime && (
            <span
              className="select-none"
              style={{
                marginLeft: 7,
                fontSize: 10.5,
                color: metaColor,
                whiteSpace: 'nowrap',
                verticalAlign: '-1px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <RelativeTime iso={message.created_at} />
              {own && pending && <ClockIcon />}
              {own && !pending && !failed && <CheckIcon />}
            </span>
          )}
          {message.attachments.map((a, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: attachments are append-only within a message
              key={`${message.id}-att-${i}-${a.kind}`}
              className={hasText || i > 0 ? 'mt-2' : ''}
            >
              <AttachmentBlock attachment={a} />
            </div>
          ))}
        </div>

        {tail && !inlineTime && (
          <div
            className="mt-0.5 flex items-center gap-1 px-1 text-[11px]"
            style={{ color: 'var(--ink-muted)' }}
          >
            <RelativeTime iso={message.created_at} />
            {own && pending && <ClockIcon />}
            {own && !pending && !failed && <CheckIcon />}
          </div>
        )}

        {failed && (
          <div
            className="mt-0.5 flex items-center gap-2 px-1 text-[12px]"
            style={{ color: 'var(--no)' }}
          >
            <Trans>Couldn't send.</Trans>
            {onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message)}
                className="font-semibold"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--accent)',
                  padding: 0,
                }}
              >
                <Trans>Retry</Trans>
              </button>
            )}
          </div>
        )}

        {message.reply_count > 0 && onOpenThread && (
          <button
            type="button"
            onClick={() => onOpenThread(message.id)}
            className="mt-1 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--accent)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path
                d="M2 2v3a3 3 0 003 3h4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7 5L9 8L7 11"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {message.reply_count === 1 ? (
              <Trans>1 reply</Trans>
            ) : (
              <Trans>{message.reply_count} replies</Trans>
            )}
            {message.last_reply_at && (
              <span style={{ color: 'var(--ink-muted)', fontWeight: 500 }}>
                · <RelativeTime iso={message.last_reply_at} />
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ opacity: 0.85, marginLeft: 3, verticalAlign: 'middle' }}
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ opacity: 0.7, marginLeft: 3, verticalAlign: 'middle' }}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
