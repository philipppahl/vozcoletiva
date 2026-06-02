import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './api';
import { useAuthStore } from './auth/store';
import type { Profile } from './profile';
import { qk } from './query';
import { toast } from './toast';

const SIZE = 256; // output square edge, px
const MIME = 'image/webp';
const QUALITY = 0.85;

/**
 * Turn a picked/captured image File into a center-cropped, 256px-square WebP,
 * returned as standard base64 (no `data:` prefix). Re-encoding through a canvas
 * also strips EXIF — including any GPS the camera embedded.
 */
export async function processAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, MIME, QUALITY));
    if (!blob) throw new Error('encode failed');
    return base64FromBuffer(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

function base64FromBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Refresh every surface that shows an avatar once it changes. */
function invalidateAvatarSurfaces(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['projects'], exact: false }); // member lists
  void qc.invalidateQueries({ queryKey: qk.chat.dms() });
}

/** `POST /v1/me/avatar` — process the file client-side, then upload. */
export function useSetAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const data = await processAvatar(file);
      const { data: res, error } = await apiClient.POST('/v1/me/avatar', { body: { data } });
      if (error || !res) throw new Error('avatar upload failed');
      return (res as { avatar_url: string }).avatar_url;
    },
    onSuccess: (avatarUrl) => {
      qc.setQueryData<Profile | undefined>(qk.me(), (p) =>
        p ? { ...p, avatar_url: avatarUrl } : p,
      );
      syncSessionAvatar(avatarUrl);
      invalidateAvatarSurfaces(qc);
    },
    onError: () => toast.error('Couldn’t update your photo. Please try again.'),
  });
}

/** `DELETE /v1/me/avatar` — back to initials. */
export function useRemoveAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await apiClient.DELETE('/v1/me/avatar');
      if (error) throw new Error('avatar remove failed');
    },
    onSuccess: () => {
      qc.setQueryData<Profile | undefined>(qk.me(), (p) => (p ? { ...p, avatar_url: null } : p));
      syncSessionAvatar(null);
      invalidateAvatarSurfaces(qc);
    },
    onError: () => toast.error('Couldn’t remove your photo. Please try again.'),
  });
}

export function syncSessionAvatar(avatarUrl: string | null) {
  const store = useAuthStore.getState();
  if (store.session && store.session.avatarUrl !== avatarUrl) {
    store.setSession({ ...store.session, avatarUrl });
  }
}
