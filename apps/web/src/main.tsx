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
useAuthStore.getState().hydrate();

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
