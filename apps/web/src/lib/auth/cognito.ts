import {
  AuthenticationDetails,
  CognitoRefreshToken,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  type CognitoUserSession,
  type ISignUpResult,
} from 'amazon-cognito-identity-js';

import { env } from '../env';

function pool(): CognitoUserPool {
  const { userPoolId, userPoolClientId } = env();
  return new CognitoUserPool({ UserPoolId: userPoolId, ClientId: userPoolClientId });
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

export async function signUp(input: SignUpInput): Promise<{ userId: string }> {
  return new Promise((resolve, reject) => {
    const attrs = [
      new CognitoUserAttribute({ Name: 'email', Value: input.email }),
      new CognitoUserAttribute({ Name: 'name', Value: input.displayName }),
    ];
    pool().signUp(input.email, input.password, attrs, [], (err, result) => {
      if (err) return reject(err);
      const r = result as ISignUpResult | undefined;
      if (!r) return reject(new Error('Sign-up returned no result'));
      resolve({ userId: r.userSub });
    });
  });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool() });
    user.confirmRegistration(code, true, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool() });
    user.resendConfirmationCode((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export interface Tokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number; // epoch seconds
}

export interface SignInOutput {
  tokens: Tokens;
  userId: string;
  email: string;
  displayName: string;
}

export async function signIn(email: string, password: string): Promise<SignInOutput> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool() });
    const details = new AuthenticationDetails({ Username: email, Password: password });
    user.authenticateUser(details, {
      onSuccess: (session) => resolve(sessionToOutput(email, session)),
      onFailure: (err) => reject(err),
    });
  });
}

function sessionToOutput(email: string, session: CognitoUserSession): SignInOutput {
  const access = session.getAccessToken();
  const id = session.getIdToken();
  const refresh = session.getRefreshToken();
  const payload = id.decodePayload() as { sub?: string; name?: string };
  return {
    tokens: {
      accessToken: access.getJwtToken(),
      idToken: id.getJwtToken(),
      refreshToken: refresh.getToken(),
      expiresAt: access.getExpiration(),
    },
    userId: payload.sub ?? '',
    email,
    displayName: payload.name ?? email.split('@')[0] ?? email,
  };
}

/**
 * Refresh the access + id tokens using a stored refresh token.
 *
 * Cognito requires the CognitoUser to be primed via `getCurrentUser()` from
 * the pool, but we don't always have that (e.g. directly after page load).
 * Instead, we construct a CognitoUser with the persisted username and call
 * `refreshSession`. The username must come from somewhere we trust.
 */
export async function refresh(email: string, refreshToken: string): Promise<Tokens> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool() });
    const rt = new CognitoRefreshToken({ RefreshToken: refreshToken });
    user.refreshSession(rt, (err, session: CognitoUserSession) => {
      if (err) return reject(err);
      const access = session.getAccessToken();
      const id = session.getIdToken();
      const newRefresh = session.getRefreshToken();
      resolve({
        accessToken: access.getJwtToken(),
        idToken: id.getJwtToken(),
        refreshToken: newRefresh.getToken(),
        expiresAt: access.getExpiration(),
      });
    });
  });
}

export function signOutLocal(email: string) {
  const user = new CognitoUser({ Username: email, Pool: pool() });
  user.signOut();
}

/** Friendly translation of Cognito error codes. */
export function mapCognitoError(err: unknown): {
  code: 'invalid_credentials' | 'already_exists' | 'invalid_code' | 'not_confirmed' | 'unknown';
  raw: string;
} {
  const e = err as { name?: string; code?: string; message?: string };
  const name = e?.name ?? e?.code ?? '';
  const msg = e?.message ?? '';
  switch (name) {
    case 'NotAuthorizedException':
    case 'UserLambdaValidationException':
      return { code: 'invalid_credentials', raw: msg };
    case 'UsernameExistsException':
      return { code: 'already_exists', raw: msg };
    case 'CodeMismatchException':
    case 'ExpiredCodeException':
      return { code: 'invalid_code', raw: msg };
    case 'UserNotConfirmedException':
      return { code: 'not_confirmed', raw: msg };
    default:
      return { code: 'unknown', raw: msg || name };
  }
}
