import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { Locale } from '@vozcoletiva/shared';

import { Toaster } from '../components/ui/Toaster';
import { useMessageBusBridge } from '../lib/messages';
import { useSyncProfileName } from '../lib/profile';

export interface RouterContext {
  locale: Locale;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  // Subscribes the mock message bus to invalidate chat query caches on
  // incoming events. No-op outside mock mode.
  useMessageBusBridge();
  // Pulls the canonical display name from the backend profile into the session.
  useSyncProfileName();
  return (
    <div className="flex min-h-dvh flex-col">
      <Outlet />
      <Toaster />
    </div>
  );
}
