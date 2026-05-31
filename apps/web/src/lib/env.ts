/**
 * Typed access to compile-time environment variables.
 *
 * The deploy script materialises `.env.production` from the CDK stack outputs
 * before the Vite build, so these values are baked into the bundle. In `bun dev`
 * the developer can set them via `.env.local` (gitignored).
 */

interface Env {
  apiBaseUrl: string;
  userPoolId: string;
  userPoolClientId: string;
  region: string;
  /** Optional — Web Push is unavailable (gracefully) when unset. */
  vapidPublicKey: string | undefined;
}

function required(key: string): string {
  const raw = import.meta.env[key];
  if (!raw || typeof raw !== 'string') {
    // Hard-fail at startup rather than later, so misconfiguration is loud.
    throw new Error(
      `Missing required env var: ${key}. Did the deploy script run before vite build?`,
    );
  }
  return raw;
}

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  cached = {
    apiBaseUrl: required('VITE_API_BASE_URL'),
    userPoolId: required('VITE_USER_POOL_ID'),
    userPoolClientId: required('VITE_USER_POOL_CLIENT_ID'),
    region: required('VITE_AWS_REGION'),
    vapidPublicKey:
      typeof import.meta.env.VITE_VAPID_PUBLIC_KEY === 'string'
        ? import.meta.env.VITE_VAPID_PUBLIC_KEY
        : undefined,
  };
  return cached;
}
