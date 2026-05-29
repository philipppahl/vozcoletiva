/**
 * Mock equivalent of the Cognito client. Any non-empty password signs in the
 * seeded user matching the email. Sign-up adds a new user immediately
 * (no email verification round-trip). Tokens are opaque strings; the api
 * layer never inspects them (the mock handlers ignore the Authorization
 * header — `requireCurrentUser()` reads from `db.currentUserId`).
 */

import { mockNow } from './clock';
import { getDb, type MockUser } from './db';

export interface MockTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface MockSignInOutput {
  tokens: MockTokens;
  userId: string;
  email: string;
  displayName: string;
}

function fakeTokens(userId: string): MockTokens {
  const ts = Math.floor(mockNow() / 1000);
  return {
    accessToken: `mock.access.${userId}.${ts}`,
    idToken: `mock.id.${userId}.${ts}`,
    refreshToken: `mock.refresh.${userId}.${ts}`,
    expiresAt: ts + 60 * 60 * 24, // 24h
  };
}

function findUserByEmail(email: string): MockUser | undefined {
  return Array.from(getDb().users.values()).find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );
}

export async function mockSignIn(email: string, password: string): Promise<MockSignInOutput> {
  if (!password) throw new Error('Password required');
  let user = findUserByEmail(email);
  if (!user) {
    // Convenience: signing in with an unknown email creates a guest user so
    // we never have to remember exact seed emails.
    const userId = `u-guest-${Date.now().toString(36)}`;
    user = {
      userId,
      email,
      displayName: email.split('@')[0] ?? email,
    };
    getDb().users.set(userId, user);
  }
  getDb().currentUserId = user.userId;
  return {
    tokens: fakeTokens(user.userId),
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
  };
}

export async function mockSignUp(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<{ userId: string }> {
  const existing = findUserByEmail(input.email);
  if (existing) {
    const err = new Error('User already exists') as Error & { name: string };
    err.name = 'UsernameExistsException';
    throw err;
  }
  const userId = `u-${input.email.split('@')[0]}-${Date.now().toString(36)}`;
  getDb().users.set(userId, {
    userId,
    email: input.email,
    displayName: input.displayName,
  });
  return { userId };
}

export async function mockConfirmSignUp(_email: string, _code: string): Promise<void> {
  // no-op in mock mode
}

export async function mockResendCode(_email: string): Promise<void> {
  // no-op
}

export async function mockRefresh(_email: string, _refreshToken: string): Promise<MockTokens> {
  const me = getDb().currentUserId;
  return fakeTokens(me ?? 'unknown');
}

export function mockSignOutLocal(_email: string): void {
  getDb().currentUserId = null;
}
