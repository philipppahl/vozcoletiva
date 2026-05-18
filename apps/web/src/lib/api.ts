import type { paths } from '@vozcoletiva/api-client';
import createClient, { type Middleware } from 'openapi-fetch';

import { refresh } from './auth/cognito';
import { useAuthStore } from './auth/store';
import { env } from './env';

/**
 * Build the typed API client with two pieces of middleware:
 *
 *  - request: attach `Authorization: Bearer <access>` if we have a session
 *  - response: on 401, attempt one refresh + retry; on subsequent 401, sign out
 */
const SKEW_SECONDS = 30; // refresh a bit before actual expiry

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const session = useAuthStore.getState().session;
    if (!session) return request;
    let { accessToken } = session.tokens;
    const now = Math.floor(Date.now() / 1000);
    if (session.tokens.expiresAt - SKEW_SECONDS <= now) {
      try {
        const fresh = await refresh(session.email, session.tokens.refreshToken);
        useAuthStore.getState().updateTokens(fresh);
        accessToken = fresh.accessToken;
      } catch {
        useAuthStore.getState().clear();
        return request;
      }
    }
    request.headers.set('authorization', `Bearer ${accessToken}`);
    return request;
  },
  async onResponse({ response }) {
    if (response.status !== 401) return response;
    const session = useAuthStore.getState().session;
    if (!session) return response;

    // The pre-flight refresh above usually handles this. If we still got a
    // 401 it means the token was rejected for another reason (rotated keys,
    // revoked, …). Sign out and propagate.
    useAuthStore.getState().clear();
    return response;
  },
};

export const apiClient = createClient<paths>({ baseUrl: env().apiBaseUrl });
apiClient.use(authMiddleware);
