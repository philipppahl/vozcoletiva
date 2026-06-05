import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiClient } from './api';
import { useAuth } from './auth/hooks';
import { env } from './env';
import { applyPatches, rollback } from './optimistic';
import { qk } from './query';
import { toast } from './toast';

export interface NotificationPrefs {
  mention: boolean;
  reply: boolean;
  comment_on_yours: boolean;
  proposal_closed: boolean;
  document_amended: boolean;
  direct_message: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  mention: true,
  reply: true,
  comment_on_yours: true,
  proposal_closed: true,
  document_amended: true,
  direct_message: true,
};

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

/** This browser's local push subscription endpoint, or null if not subscribed. */
async function currentEndpoint(): Promise<string | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub?.endpoint ?? null;
}

/** Re-POST the local subscription so the server has it (self-heals a failed
 *  registration / a server-side prune — decision 0035). */
async function reRegisterLocal(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const keys = sub.toJSON().keys ?? {};
  await apiClient.POST('/v1/me/push-subscriptions', {
    body: { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh ?? '', auth: keys.auth ?? '' } },
  });
}

export interface DevicePrefsState {
  /** This browser's subscription endpoint (its device key). */
  endpoint: string | null;
  /** This device's per-kind prefs, or null when not subscribed. */
  prefs: NotificationPrefs | null;
  /** Whether this device is registered server-side. */
  registered: boolean;
}

/** This device's notification preferences (decision 0035). Resolves the local
 *  endpoint, reads the server's subscriptions, and reconciles a missing one. */
export function useDevicePrefs() {
  const { session } = useAuth();
  return useQuery({
    queryKey: qk.devicePushPrefs(),
    enabled: !!session && pushSupported(),
    queryFn: async (): Promise<DevicePrefsState> => {
      const endpoint = await currentEndpoint();
      if (!endpoint) return { endpoint: null, prefs: null, registered: false };
      const { data } = await apiClient.GET('/v1/me/push-subscriptions');
      const mine = data?.subscriptions.find((s) => s.endpoint === endpoint);
      if (mine) return { endpoint, prefs: mine.prefs, registered: true };
      // Local subscription exists but the server forgot it — re-register.
      await reRegisterLocal();
      return { endpoint, prefs: DEFAULT_PREFS, registered: true };
    },
  });
}

export function useUpdateDevicePrefs() {
  const qc = useQueryClient();
  const key = qk.devicePushPrefs();
  return useMutation({
    mutationFn: async (vars: { endpoint: string; prefs: NotificationPrefs }) => {
      const { data, error } = await apiClient.PUT('/v1/me/push-subscriptions/prefs', {
        body: vars,
      });
      if (error || !data) throw new Error('failed to save prefs');
      return data as NotificationPrefs;
    },
    // Flip the toggle instantly.
    onMutate: (vars) =>
      applyPatches(qc, [
        {
          key,
          update: (prev?: DevicePrefsState) => (prev ? { ...prev, prefs: vars.prefs } : prev),
        },
      ]),
    onError: (_e, _v, ctx) => {
      rollback(qc, ctx);
      toast.error('Couldn’t update notifications. Please try again.');
    },
    onSuccess: (data) =>
      qc.setQueryData<DevicePrefsState | undefined>(key, (prev) =>
        prev ? { ...prev, prefs: data } : prev,
      ),
  });
}
