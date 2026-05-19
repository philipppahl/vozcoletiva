import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useState } from 'react';

import { Button } from './ui/Button';

interface CommentFormProps {
  initialBody?: string;
  submitLabel?: string;
  placeholder?: string;
  busy?: boolean;
  onSubmit: (body: string) => Promise<void> | void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function CommentForm({
  initialBody = '',
  submitLabel,
  placeholder,
  busy,
  onSubmit,
  onCancel,
  autoFocus,
}: CommentFormProps) {
  const { _ } = useLingui();
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);

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
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
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
