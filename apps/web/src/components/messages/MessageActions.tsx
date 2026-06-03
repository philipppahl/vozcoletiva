import { Trans } from '@lingui/macro';
import type { ReactNode } from 'react';

import type { Message } from '../../lib/messages/types';
import { Sheet } from '../ui/Sheet';

interface MessageActionsProps {
  message: Message | null;
  onClose: () => void;
  onReply: (m: Message) => void;
  /** Channels only — open the focused thread of this message. */
  onOpenThread?: (messageId: string) => void;
}

/**
 * Long-press action sheet for a chat message (decision 0031): reply (quote),
 * open a thread (channels), or copy the text. Reactions arrive in Phase 2.
 */
export function MessageActions({ message, onClose, onReply, onOpenThread }: MessageActionsProps) {
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
