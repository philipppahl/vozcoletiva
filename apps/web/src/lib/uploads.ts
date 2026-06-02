import { apiClient } from './api';

export interface UploadResult {
  key: string;
  url: string;
}

/**
 * Get a presigned PUT URL from the API, upload the blob straight to S3 with the
 * exact content-type (the URL is signed for it), and return the object key +
 * public CDN URL. Keeps large media off the API request path.
 */
export async function uploadBlob(blob: Blob, ext: string): Promise<UploadResult> {
  const contentType = blob.type || 'application/octet-stream';
  const { data, error } = await apiClient.POST('/v1/uploads', {
    body: { content_type: contentType, ext },
  });
  if (error || !data) throw new Error('upload_init_failed');
  const { put_url, key, url } = data as { put_url: string; key: string; url: string };
  const res = await fetch(put_url, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: blob,
  });
  if (!res.ok) throw new Error('upload_put_failed');
  return { key, url };
}

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  ext: string;
}

/**
 * Downscale a picked image to a square-fitting max edge and re-encode to WebP.
 * `createImageBitmap(..., from-image)` applies EXIF orientation (and the canvas
 * re-encode strips the rest of the EXIF, including GPS).
 */
export async function compressImage(file: File, maxEdge = 1600): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.85));
    if (!blob) throw new Error('encode failed');
    return { blob, width, height, ext: 'webp' };
  } finally {
    bitmap.close();
  }
}

/** Best-effort extension from a filename. */
export function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name);
  return m ? m[1]!.toLowerCase() : 'bin';
}
