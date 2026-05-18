import createClient from 'openapi-fetch';
import type { paths } from './generated/schema';

export type { components, paths } from './generated/schema';

/**
 * Construct an API client bound to a base URL.
 *
 * The base URL comes from the consuming app's environment (e.g. `VITE_API_BASE_URL`
 * in `apps/web/`). The client returns fully-typed responses derived from the
 * OpenAPI spec at `apps/api/openapi.yaml`.
 */
export function makeClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type Client = ReturnType<typeof makeClient>;
