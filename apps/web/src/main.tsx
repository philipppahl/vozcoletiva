import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/public-sans';
import '@fontsource-variable/jetbrains-mono';
import './styles/global.css';
import { currentLocale, initI18n } from './i18n';
import { useAuthStore } from './lib/auth/store';
import { queryClient } from './lib/query';
import { initTheme } from './lib/theme';
import { routeTree } from './routeTree.gen';

initTheme();
initI18n();

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  context: { locale: currentLocale() },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

/** Start the mock layer (when enabled) before anything makes a request, then
 *  hydrate auth and render. Wrapped in a function rather than top-level await
 *  so the production build target (es2020) doesn't choke. */
async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCKS === '1') {
    const { startMocks } = await import('./mocks/browser');
    await startMocks();
    // The mock db is the source of truth for "who is signed in" while the app
    // runs. If a persisted session already exists, restore the mock-side
    // currentUserId so handlers recognise the caller; otherwise leave both
    // sides signed-out.
    const persisted = window.localStorage.getItem('voz.auth.session');
    if (persisted) {
      try {
        const sess = JSON.parse(persisted) as { userId: string };
        const { getDb } = await import('./mocks/db');
        if (getDb().users.has(sess.userId)) {
          getDb().currentUserId = sess.userId;
        }
      } catch {
        // ignore malformed session
      }
    }
  }
  // The comms-hybrid (VITE_MOCK_COMMS) is retired — every surface is real now.

  useAuthStore.getState().hydrate();

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element #root not found in index.html');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <I18nProvider i18n={i18n}>
          <RouterProvider router={router} />
        </I18nProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
