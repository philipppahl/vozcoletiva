import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { Locale } from '@vozcoletiva/shared';

import { HandleGate } from '../components/HandleGate';
import { Lightbox } from '../components/messages/Lightbox';
import { Toaster } from '../components/ui/Toaster';
import { useMessageBusBridge } from '../lib/messages';
import { useSyncProfileName } from '../lib/profile';
import { useRealtimeSocket } from '../lib/realtime';

export interface RouterContext {
  locale: Locale;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  // Live chat delivery over the realtime WebSocket (decision 0028). Dormant
  // when VITE_WS_URL is unset; chat then falls back to polling.
  useRealtimeSocket();
  // Subscribes the mock message bus to invalidate chat query caches on
  // incoming events. No-op outside mock mode.
  useMessageBusBridge();
  // Pulls the canonical display name from the backend profile into the session.
  useSyncProfileName();
  return (
    <div className="flex min-h-dvh flex-col">
      <Outlet />
      <HandleGate />
      <Lightbox />
      <Toaster />
    </div>
  );
}
