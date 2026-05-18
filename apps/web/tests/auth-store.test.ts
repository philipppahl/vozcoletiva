import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '../src/lib/auth/store';

const SAMPLE_SESSION = {
  userId: 'sub-123',
  email: 'voter@example.com',
  displayName: 'Ada',
  tokens: {
    accessToken: 'access',
    idToken: 'id',
    refreshToken: 'refresh',
    expiresAt: 9_999_999_999,
  },
};

describe('auth store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({ status: 'unknown', session: null });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('hydrates as signed-out when storage is empty', () => {
    useAuthStore.getState().hydrate();
    const state = useAuthStore.getState();
    expect(state.status).toBe('signed-out');
    expect(state.session).toBeNull();
  });

  it('persists and hydrates a session round-trip', () => {
    useAuthStore.getState().setSession(SAMPLE_SESSION);
    expect(useAuthStore.getState().status).toBe('signed-in');

    // Simulate a page reload: clear in-memory state, then hydrate from storage.
    useAuthStore.setState({ status: 'unknown', session: null });
    useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.status).toBe('signed-in');
    expect(state.session?.userId).toBe('sub-123');
    expect(state.session?.displayName).toBe('Ada');
  });

  it('clears storage on sign-out', () => {
    useAuthStore.getState().setSession(SAMPLE_SESSION);
    useAuthStore.getState().clear();
    expect(useAuthStore.getState().status).toBe('signed-out');
    expect(useAuthStore.getState().session).toBeNull();
    expect(window.localStorage.getItem('voz.auth.session')).toBeNull();
  });

  it('updateTokens preserves identity fields', () => {
    useAuthStore.getState().setSession(SAMPLE_SESSION);
    useAuthStore.getState().updateTokens({
      accessToken: 'new-a',
      idToken: 'new-id',
      refreshToken: 'new-r',
      expiresAt: 1234,
    });
    const s = useAuthStore.getState().session;
    expect(s?.email).toBe('voter@example.com');
    expect(s?.tokens.accessToken).toBe('new-a');
    expect(s?.tokens.expiresAt).toBe(1234);
  });
});
