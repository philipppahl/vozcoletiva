import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/global.css';
import { currentLocale } from './i18n';
import { initTheme } from './lib/theme';
import { routeTree } from './routeTree.gen';

initTheme();

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
    <RouterProvider router={router} />
  </StrictMode>,
);
