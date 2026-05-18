import { Trans, t } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { useState } from 'react';

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { _ } = useLingui();
  const [copied, setCopied] = useState(false);
  async function onClick() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore; user can long-press to copy on platforms without clipboard permission
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[36px] rounded-full px-3 py-1 text-xs font-semibold transition"
      style={{
        background: copied ? 'var(--color-success)' : 'var(--surface-raised)',
        color: copied ? '#ffffff' : 'var(--text-primary)',
        border: '1px solid var(--border)',
      }}
      aria-label={label ?? _(t`Copy`)}
    >
      {copied ? <Trans>Copied</Trans> : (label ?? <Trans>Copy</Trans>)}
    </button>
  );
}
