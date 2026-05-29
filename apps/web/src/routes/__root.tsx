import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { Locale } from '@vozcoletiva/shared';

import { useMessageBusBridge } from '../lib/messages';

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
  return (
    <div className="flex min-h-dvh flex-col">
      <Outlet />
    </div>
  );
}
