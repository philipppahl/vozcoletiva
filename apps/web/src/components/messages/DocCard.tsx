import type { Attachment } from '../../lib/messages/types';
import { AttachmentImage } from './AttachmentImage';
import { VoiceNoteBlock } from './VoiceNoteBlock';

/** Render any attachment kind in a message bubble. */
export function AttachmentBlock({ attachment }: { attachment: Attachment }) {
  if (attachment.kind === 'image') return <AttachmentImage attachment={attachment} />;
  if (attachment.kind === 'doc') return <DocCard attachment={attachment} />;
  return <VoiceNoteBlock attachment={attachment} />;
}

/** A downloadable document card (icon + filename + size). */
export function DocCard({ attachment }: { attachment: Attachment }) {
  if (attachment.kind !== 'doc') return null;
  const size = attachment.size ? humanSize(attachment.size) : '';
  return (
    <a
      href={attachment.url || undefined}
      target="_blank"
      rel="noreferrer noopener"
      download
      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
      style={{
        background: 'var(--surface)',
        border: '0.5px solid var(--border)',
        maxWidth: 260,
        textDecoration: 'none',
      }}
    >
      <span
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M14 3v4a1 1 0 001 1h4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 3h9l5 5v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
          {attachment.name ?? 'Document'}
        </span>
        {size && (
          <span className="block text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            {size}
          </span>
        )}
      </span>
    </a>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
