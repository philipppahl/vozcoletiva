import { setupWorker } from 'msw/browser';
import { getDb } from './db';
import { handlers } from './handlers';
import { inboxHandlers } from './handlers/inbox';
import { searchHandlers } from './handlers/search';
import { applyScenario, loadScenarioId } from './scenarios';

let worker: ReturnType<typeof setupWorker> | null = null;

export async function startMocks(): Promise<void> {
  // Seed the db before the worker starts handling requests so the first
  // tick doesn't race a request against an empty store.
  applyScenario(loadScenarioId());
  if (!worker) worker = setupWorker(...handlers);
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: true,
  });
  // Expose for the ScenarioPicker reset flow.
  (window as unknown as { __VOZ_MOCK__?: unknown }).__VOZ_MOCK__ = {
    applyScenario,
  };
}

/**
 * Hybrid mode: messaging (channels, DMs, threads, reads) is now on the real API;
 * only the **inbox + search** backends don't exist yet, so MSW intercepts only
 * those endpoints and serves mock data; every other `/v1` request is bypassed to
 * the real API (`onUnhandledRequest: 'bypass'`). The mock db is seeded so those
 * two surfaces stay populated. See decision 0020.
 */
export async function startCommsMocks(): Promise<void> {
  applyScenario(loadScenarioId());
  // No mock sign-in in hybrid mode — `seed()` already pins a demo currentUserId,
  // but guard in case a scenario leaves it unset.
  if (!getDb().currentUserId) {
    const demo = [...getDb().users.values()][0];
    if (demo) getDb().currentUserId = demo.userId;
  }
  const commsWorker = setupWorker(...inboxHandlers, ...searchHandlers);
  await commsWorker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: true,
  });
}
