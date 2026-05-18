import { Navigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { useAuthStore } from '../lib/auth/store';

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'unknown') {
    return null; // brief flash; could render a spinner instead
  }
  if (status === 'signed-out') {
    return <Navigate to="/sign-in" replace />;
  }
  return <>{children}</>;
}
