import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiClient } from './api';
import { useAuth } from './auth/hooks';
import { env } from './env';
import { applyPatches, rollback } from './optimistic';
import { qk } from './query';
import { toast } from './toast';

export interface NotificationPrefs {
  push_enabled: boolean;
  mention: boolean;
  reply: boolean;
  comment_on_yours: boolean;
  proposal_closed: boolean;
  document_amended: boolean;
  direct_message: boolean;
}

/** Whether this browser can do Web Push at all. */
export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!env().vapidPublicKey
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Reflects the live `PushManager` subscription state for this browser. */
export function usePushSubscriptionState() {
  const [enabled, setEnabled] = useState<boolean | null>(null); // null = unknown/loading
  useEffect(() => {
    if (!pushSupported()) {
      setEnabled(false);
      return;
    }
    let cancelled = false;
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setEnabled(!!sub);
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}

async function subscribeBrowser(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('notifications_denied');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(env().vapidPublicKey ?? ''),
  });
  const json = sub.toJSON();
  const keys = json.keys ?? {};
  const { error } = await apiClient.POST('/v1/me/push-subscriptions', {
    body: {
      endpoint: sub.endpoint,
      keys: { p256dh: keys.p256dh ?? '', auth: keys.auth ?? '' },
    },
  });
  if (error) throw new Error('subscribe_failed');
}

async function unsubscribeBrowser(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await apiClient.POST('/v1/me/push-subscriptions/remove', {
    body: { endpoint: sub.endpoint },
  });
  await sub.unsubscribe();
}

export function useEnablePush() {
  return useMutation({ mutationFn: subscribeBrowser });
}

export function useDisablePush() {
  return useMutation({ mutationFn: unsubscribeBrowser });
}

export function useNotificationPrefs() {
  const { session } = useAuth();
  return useQuery({
    queryKey: qk.notificationPrefs(),
    enabled: !!session,
    queryFn: async (): Promise<NotificationPrefs> => {
      const { data, error } = await apiClient.GET('/v1/me/notification-prefs');
      if (error || !data) throw new Error('failed to load prefs');
      return data as NotificationPrefs;
    },
  });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  const key = qk.notificationPrefs();
  return useMutation({
    mutationFn: async (prefs: NotificationPrefs): Promise<NotificationPrefs> => {
      const { data, error } = await apiClient.PUT('/v1/me/notification-prefs', { body: prefs });
      if (error || !data) throw new Error('failed to save prefs');
      return data as NotificationPrefs;
    },
    // Flip the toggle instantly.
    onMutate: (prefs: NotificationPrefs) => applyPatches(qc, [{ key, update: () => prefs }]),
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Couldn’t update notifications. Please try again.');
    },
    onSuccess: (data) => qc.setQueryData(key, data),
  });
}
