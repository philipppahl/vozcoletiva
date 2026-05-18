import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/global.css';
import { currentLocale, initI18n } from './i18n';
import { useAuthStore } from './lib/auth/store';
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
    <I18nProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nProvider>
  </StrictMode>,
);
