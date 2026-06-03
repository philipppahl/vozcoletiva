import { useLightbox } from '../../lib/lightbox';
import type { Attachment } from '../../lib/messages/types';

interface AttachmentImageProps {
  attachment: Attachment;
  /** The message's image attachments, so the lightbox can swipe between them. */
  siblings?: Attachment[];
}

export function AttachmentImage({ attachment, siblings }: AttachmentImageProps) {
  const show = useLightbox((s) => s.show);
  if (attachment.kind !== 'image') return null;
  const w = attachment.width ?? 320;
  const h = attachment.height ?? 180;
  const gallery = (siblings && siblings.length ? siblings : [attachment]).filter(
    (a) => a.kind === 'image',
  );
  const index = Math.max(
    0,
    gallery.findIndex((a) => a.url === attachment.url),
  );
  return (
    <button
      type="button"
      onClick={() =>
        show(
          gallery.map((a) => ({ url: a.url, name: a.name })),
          index,
        )
      }
      className="block overflow-hidden rounded-xl"
      style={{
        background: 'var(--surface-2)',
        border: '0.5px solid var(--border)',
        maxWidth: 'min(100%, 320px)',
        aspectRatio: `${w} / ${h}`,
        cursor: 'zoom-in',
        padding: 0,
      }}
    >
      <img
        src={attachment.url}
        alt=""
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </button>
  );
}
