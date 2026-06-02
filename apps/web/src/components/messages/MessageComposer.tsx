import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useMemo, useRef, useState } from 'react';

import type { Attachment } from '../../lib/messages/types';
import type { MentionCandidate } from './MentionPopover';
import { MentionPopover } from './MentionPopover';

interface MessageComposerProps {
  /** Members of the conversation, used for the mention popover. */
  mentionCandidates: MentionCandidate[];
  /** Called with the typed body + any attachments collected. */
  onSubmit: (body: string, attachments: Attachment[]) => Promise<void> | void;
  /** When true, the composer is awaiting a server response. */
  pending: boolean;
  placeholder?: string;
}

const PLACEHOLDER_GRADIENTS = [
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0%" stop-color="%23F472B6"/><stop offset="100%" stop-color="%237C3AED"/></linearGradient></defs><rect width="320" height="180" fill="url(%23g)"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2360A5FA"/><stop offset="100%" stop-color="%23047857"/></linearGradient></defs><rect width="320" height="180" fill="url(%23g)"/></svg>',
];

export function MessageComposer({
  mentionCandidates,
  onSubmit,
  pending,
  placeholder,
}: MessageComposerProps) {
  const { _ } = useLingui();
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [activeMention, setActiveMention] = useState(0);

  const filtered = useMemo(() => {
    if (mentionQuery == null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionCandidates
      .filter((c) => c.display_name.toLowerCase().includes(q) || c.user_id.includes(q))
      .slice(0, 6);
  }, [mentionCandidates, mentionQuery]);

  function updateValue(next: string) {
    setValue(next);
    // Detect the `@token-being-typed` at the current caret position.
    const caret = ref.current?.selectionStart ?? next.length;
    const upToCaret = next.slice(0, caret);
    const m = /@([a-z0-9-]*)$/i.exec(upToCaret);
    if (m) {
      setMentionQuery(m[1] ?? '');
      setActiveMention(0);
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(c: MentionCandidate) {
    const ta = ref.current;
    const caret = ta?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const tokenStart = before.lastIndexOf('@');
    if (tokenStart < 0) return;
    const next = `${before.slice(0, tokenStart)}@${c.user_id} ${after}`;
    setValue(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      ta?.focus();
      const newCaret = tokenStart + c.user_id.length + 2; // @ + id + space
      ta?.setSelectionRange(newCaret, newCaret);
    });
  }

  function addImage() {
    const grad = PLACEHOLDER_GRADIENTS[Math.floor(Math.random() * PLACEHOLDER_GRADIENTS.length)]!;
    setAttachments((prev) => [
      ...prev,
      { kind: 'image' as const, url: grad, width: 320, height: 180 },
    ]);
  }

  function addVoice() {
    setAttachments((prev) => [
      ...prev,
      { kind: 'voice' as const, url: '', durationMs: 12_000 + Math.floor(Math.random() * 30_000) },
    ]);
  }

  function submit() {
    const body = value.trim();
    if (!body && attachments.length === 0) return;
    const sent = attachments;
    // Clear immediately — the message shows optimistically, so the composer
    // shouldn't wait for the server round-trip to feel responsive.
    setValue('');
    setAttachments([]);
    setMentionQuery(null);
    void onSubmit(body, sent);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveMention((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveMention((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const pick = filtered[activeMention];
        if (pick) insertMention(pick);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div
      className="relative flex flex-col gap-2 border-t px-3 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]"
      style={{
        background: 'var(--bg)',
        borderColor: 'var(--border)',
      }}
    >
      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-1">
          {attachments.map((a, idx) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: attachments are local-only state, not user-reorderable
              key={`att-${idx}-${a.kind}`}
              className="relative overflow-hidden rounded-lg"
              style={{
                background: 'var(--surface-2)',
                border: '0.5px solid var(--border)',
              }}
            >
              {a.kind === 'image' ? (
                <img
                  src={a.url}
                  alt=""
                  style={{
                    display: 'block',
                    width: 56,
                    height: 56,
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  className="flex items-center justify-center text-[10px] font-medium uppercase"
                  style={{
                    width: 56,
                    height: 56,
                    color: 'var(--ink-soft)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: 1,
                  }}
                >
                  voice
                </div>
              )}
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() =>
                  setAttachments((prev) => prev.filter((_, otherIdx) => otherIdx !== idx))
                }
                className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full"
                style={{
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative flex items-end gap-2">
        <button
          type="button"
          onClick={addImage}
          aria-label={_(t`Attach image (placeholder)`)}
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'var(--surface-2)',
            border: '0.5px solid var(--border)',
            color: 'var(--ink-soft)',
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M9 4v10M4 9h10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={addVoice}
          aria-label={_(t`Voice note (placeholder)`)}
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'var(--surface-2)',
            border: '0.5px solid var(--border)',
            color: 'var(--ink-soft)',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="5" y="1" width="4" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M2 7a5 5 0 0010 0M7 12v1.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="relative min-w-0 flex-1">
          {mentionQuery !== null && (
            <MentionPopover
              candidates={filtered}
              active={activeMention}
              onPick={insertMention}
              onHover={setActiveMention}
            />
          )}
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => updateValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? _(t`Message — @ to mention`)}
            rows={1}
            className="w-full resize-none rounded-2xl px-4 py-2.5 outline-none"
            style={{
              background: 'var(--field-bg)',
              color: 'var(--ink)',
              border: '1px solid transparent',
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              lineHeight: 1.4,
              minHeight: 40,
              maxHeight: 200,
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={pending || (value.trim().length === 0 && attachments.length === 0)}
          aria-label={_(t`Send message`)}
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            border: 'none',
            cursor: 'pointer',
            opacity: pending || (value.trim().length === 0 && attachments.length === 0) ? 0.5 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 8l12-6-4 14-3-6-5-2z" fill="currentColor" />
          </svg>
        </button>
      </div>
      <div
        className="px-1 text-[10.5px]"
        style={{
          color: 'var(--ink-muted)',
          fontFamily: 'var(--font-mono)',
          letterSpacing: 0.5,
        }}
      >
        <Trans>**bold** *italic* `code` [link](url) — @ to mention</Trans>
      </div>
    </div>
  );
}
