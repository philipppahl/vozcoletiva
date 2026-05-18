import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { Locale } from '@vozcoletiva/shared';

export interface RouterContext {
  locale: Locale;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Outlet />
    </div>
  );
}
