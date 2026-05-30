import { setupWorker } from 'msw/browser';
import { getDb } from './db';
import { handlers } from './handlers';
import { conversationsHandlers } from './handlers/conversations';
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
 * Hybrid mode: the messages / DMs / inbox / search backends don't exist on the
 * real API yet, so MSW intercepts **only** those endpoints and serves mock
 * data; every other `/v1` request is bypassed to the real API
 * (`onUnhandledRequest: 'bypass'`). The mock db is seeded (demo project slug
 * `vila-madalena` + a demo current user) so those surfaces stay populated.
 */
export async function startCommsMocks(): Promise<void> {
  applyScenario(loadScenarioId());
  // No mock sign-in in hybrid mode — `seed()` already pins a demo currentUserId,
  // but guard in case a scenario leaves it unset.
  if (!getDb().currentUserId) {
    const demo = [...getDb().users.values()][0];
    if (demo) getDb().currentUserId = demo.userId;
  }
  const commsWorker = setupWorker(
    ...conversationsHandlers,
    ...inboxHandlers,
    ...searchHandlers,
  );
  await commsWorker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: true,
  });
}
