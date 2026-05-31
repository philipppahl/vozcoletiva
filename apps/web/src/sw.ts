/// <reference lib="webworker" />
/**
 * Push-capable service worker (decision 0025). Precaches the app shell
 * (Workbox) and handles `push` (show a notification) + `notificationclick`
 * (deep-link).
 */
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

precacheAndRoute(self.__WB_MANIFEST);

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event: PushEvent) => {
  let data: PushPayload = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  const title = data.title ?? 'vozcoletiva';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        if ('focus' in w) {
          await (w as WindowClient).navigate(url);
          return (w as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});

self.addEventListener('install', () => {
  void self.skipWaiting();
});
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});
