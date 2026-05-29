import type { Attachment } from '../../lib/messages/types';

interface AttachmentImageProps {
  attachment: Attachment;
}

export function AttachmentImage({ attachment }: AttachmentImageProps) {
  if (attachment.kind !== 'image') return null;
  const w = attachment.width ?? 320;
  const h = attachment.height ?? 180;
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer noopener"
      className="block overflow-hidden rounded-xl"
      style={{
        background: 'var(--surface-2)',
        border: '0.5px solid var(--border)',
        maxWidth: 'min(100%, 320px)',
        aspectRatio: `${w} / ${h}`,
      }}
    >
      <img
        src={attachment.url}
        alt=""
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </a>
  );
}
