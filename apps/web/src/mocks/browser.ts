import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
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
