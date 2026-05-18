import * as cognito from './cognito';
import { type AuthSession, useAuthStore } from './store';

export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);

  async function signUp(input: cognito.SignUpInput): Promise<{ userId: string }> {
    return cognito.signUp(input);
  }

  async function confirmSignUp(email: string, code: string): Promise<void> {
    return cognito.confirmSignUp(email, code);
  }

  async function signIn(email: string, password: string): Promise<AuthSession> {
    const out = await cognito.signIn(email, password);
    const sess: AuthSession = {
      userId: out.userId,
      email: out.email,
      displayName: out.displayName,
      tokens: out.tokens,
    };
    setSession(sess);
    return sess;
  }

  function signOut() {
    if (session) cognito.signOutLocal(session.email);
    clear();
  }

  return { status, session, signUp, confirmSignUp, signIn, signOut };
}

export function useUser(): AuthSession | null {
  return useAuthStore((s) => s.session);
}
