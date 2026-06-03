import { Trans } from '@lingui/macro';
import type { ReactNode } from 'react';

import { type Message, REACTIONS } from '../../lib/messages/types';
import { Sheet } from '../ui/Sheet';

interface MessageActionsProps {
  message: Message | null;
  onClose: () => void;
  onReply: (m: Message) => void;
  /** Channels only — open the focused thread of this message. */
  onOpenThread?: (messageId: string) => void;
  /** Toggle a reaction (decision 0031). */
  onToggleReaction?: (messageId: string, emoji: string, active: boolean) => void;
  /** Enter free text-selection mode for this message. */
  onSelectText?: (m: Message) => void;
}

/**
 * Long-press action sheet for a chat message (decision 0031): a reaction bar,
 * then reply (quote), open a thread (channels), or copy the text.
 */
export function MessageActions({
  message,
  onClose,
  onReply,
  onOpenThread,
  onToggleReaction,
  onSelectText,
}: MessageActionsProps) {
  const m = message;
  const hasText = !!m?.body.trim();
  return (
    <Sheet
      open={!!m}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      side="bottom"
      title={<Trans>Message actions</Trans>}
    >
      {onToggleReaction && m && (
        <div className="mb-1 flex items-center justify-between px-3 pt-1">
          {REACTIONS.map((emoji) => {
            const mine = m.reactions.some((r) => r.emoji === emoji && r.me);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggleReaction(m.id, emoji, !mine);
                  onClose();
                }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[24px]"
                style={{
                  background: mine ? 'var(--accent-soft)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  lineHeight: 1,
                }}
                aria-label={emoji}
                aria-pressed={mine}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-col px-2 pb-4">
        <ActionRow
          icon={<ReplyIcon />}
          label={<Trans>Reply</Trans>}
          onClick={() => {
            if (m) onReply(m);
            onClose();
          }}
        />
        {onOpenThread && (
          <ActionRow
            icon={<ThreadIcon />}
            label={
              m && m.reply_count > 0 ? <Trans>Open thread</Trans> : <Trans>Start thread</Trans>
            }
            onClick={() => {
              if (m) onOpenThread(m.id);
              onClose();
            }}
          />
        )}
        {hasText && (
          <ActionRow
            icon={<CopyIcon />}
            label={<Trans>Copy text</Trans>}
            onClick={() => {
              if (m) void navigator.clipboard?.writeText(m.body).catch(() => {});
              onClose();
            }}
          />
        )}
        {hasText && onSelectText && (
          <ActionRow
            icon={<SelectIcon />}
            label={<Trans>Select text</Trans>}
            onClick={() => {
              if (m) onSelectText(m);
              onClose();
            }}
          />
        )}
      </div>
    </Sheet>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px]"
      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
    >
      <span style={{ color: 'var(--ink-soft)', display: 'inline-flex' }}>{icon}</span>
      {label}
    </button>
  );
}

function ReplyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 17l-5-5 5-5M4 12h11a5 5 0 015 5v1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThreadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5v4a3 3 0 003 3h9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 8l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 15V5a2 2 0 012-2h10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SelectIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M9 8.5v7M12 8.5v7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
