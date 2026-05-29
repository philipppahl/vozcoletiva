import { Trans } from '@lingui/macro';

import type { Message } from '../../lib/messages/types';
import { RelativeTime } from '../RelativeTime';
import { Avatar } from '../shell/Avatar';
import { AttachmentImage } from './AttachmentImage';
import { MessageMarkdown } from './messageMarkdown';
import { VoiceNoteBlock } from './VoiceNoteBlock';

interface MessageRowProps {
  message: Message;
  /** When true, this message is in a same-author group with the previous row;
   *  the avatar + name + timestamp are suppressed to tighten the visual. */
  grouped: boolean;
  /** When set, the "N replies" affordance opens this thread overlay. */
  onOpenThread?: (messageId: string) => void;
  /** Optional slug, threaded through the markdown renderer for @mentions. */
  projectSlug?: string;
}

export function MessageRow({ message, grouped, onOpenThread, projectSlug }: MessageRowProps) {
  return (
    <article className="flex items-start gap-3 px-4" style={{ paddingTop: grouped ? 2 : 12 }}>
      <div className="flex-shrink-0" style={{ width: 32 }}>
        {grouped ? null : <Avatar displayName={message.author_display_name} size={32} />}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div
            className="mb-0.5 flex items-baseline gap-2 text-[12.5px]"
            style={{ color: 'var(--ink-soft)' }}
          >
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>
              {message.author_display_name}
            </span>
            <span style={{ color: 'var(--ink-muted)' }}>
              <RelativeTime iso={message.created_at} />
            </span>
            {message.edited_at && (
              <span style={{ color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                · <Trans>edited</Trans>
              </span>
            )}
          </div>
        )}
        {message.body && <MessageMarkdown body={message.body} projectSlug={projectSlug} />}
        {message.attachments.map((a, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: attachments are append-only within a message
            key={`${message.id}-att-${i}-${a.kind}`}
            className="mt-2"
          >
            {a.kind === 'image' ? (
              <AttachmentImage attachment={a} />
            ) : (
              <VoiceNoteBlock attachment={a} />
            )}
          </div>
        ))}
        {message.reply_count > 0 && onOpenThread && (
          <button
            type="button"
            onClick={() => onOpenThread(message.id)}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold"
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
    </article>
  );
}
