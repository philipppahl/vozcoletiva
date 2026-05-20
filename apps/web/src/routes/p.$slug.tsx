import { createFileRoute, Outlet } from '@tanstack/react-router';

import { RequireAuth } from '../components/RequireAuth';

export const Route = createFileRoute('/p/$slug')({
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
});
