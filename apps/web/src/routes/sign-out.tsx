import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

import { useAuth } from '../lib/auth/hooks';

export const Route = createFileRoute('/sign-out')({
  component: SignOutPage,
});

function SignOutPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  useEffect(() => {
    signOut();
    navigate({ to: '/', replace: true });
  }, [signOut, navigate]);
  return null;
}
