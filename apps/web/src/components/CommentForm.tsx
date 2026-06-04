import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useEffect, useRef, useState } from 'react';

import { Button } from './ui/Button';

interface CommentFormProps {
  initialBody?: string;
  submitLabel?: string;
  placeholder?: string;
  busy?: boolean;
  onSubmit: (body: string) => Promise<void> | void;
  onCancel?: () => void;
  autoFocus?: boolean;
  /** Quote-reply banner above the field (decision 0033). */
  replyingTo?: { author_display_name: string; preview: string } | null;
  onCancelReply?: () => void;
}

export function CommentForm({
  initialBody = '',
  submitLabel,
  placeholder,
  busy,
  onSubmit,
  onCancel,
  autoFocus,
  replyingTo,
  onCancelReply,
}: CommentFormProps) {
  const { _ } = useLingui();
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Focus the field when a reply target is picked, so you can type straight away.
  useEffect(() => {
    if (replyingTo) ref.current?.focus();
  }, [replyingTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) {
      setError(_(t`Comment cannot be empty.`));
      return;
    }
    if (trimmed.length > 10_000) {
      setError(_(t`Comment must be 10000 characters or fewer.`));
      return;
    }
    try {
      await onSubmit(trimmed);
      if (!initialBody) setBody('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || _(t`Could not save the comment. Please try again.`));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {replyingTo && (
        <div
          className="flex items-center gap-2 rounded-xl border-l-2 px-3 py-2 text-xs"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--accent)',
            color: 'var(--ink-soft)',
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="font-semibold" style={{ color: 'var(--accent)' }}>
              <Trans>Replying to {replyingTo.author_display_name}</Trans>
            </div>
            <div className="truncate" style={{ color: 'var(--ink-muted)' }}>
              {replyingTo.preview || <Trans>(no text)</Trans>}
            </div>
          </div>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              aria-label={_(t`Cancel reply`)}
              className="flex-shrink-0 rounded-full px-2 py-1 text-sm font-semibold"
              style={{ background: 'transparent', border: 'none', color: 'var(--ink-muted)' }}
            >
              ✕
            </button>
          )}
        </div>
      )}
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => {
          // Keep the field visible above the soft keyboard. The discussion
          // scrolls inside the shell; wait for the keyboard to settle, then
          // bring the composer into the (now shorter) viewport.
          window.setTimeout(
            () => ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
            300,
          );
        }}
        placeholder={placeholder ?? _(t`Write a comment… (Markdown supported)`)}
        className="min-h-[88px] rounded-xl border px-3 py-2 text-base outline-none"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
        }}
        // biome-ignore lint/a11y/noAutofocus: opt-in via prop only for the edit path
        autoFocus={autoFocus}
        maxLength={10_000}
      />
      {error && (
        <span className="text-xs" style={{ color: 'var(--color-danger)' }}>
          {error}
        </span>
      )}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            <Trans>Cancel</Trans>
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {submitLabel ?? _(t`Post comment`)}
        </Button>
      </div>
    </form>
  );
}
