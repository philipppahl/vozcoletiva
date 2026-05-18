import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Route as IndexRoute } from '../src/routes/index';

describe('home route', () => {
  it('renders the wordmark and the foundation tagline', async () => {
    const rootRoute = createRootRouteWithContext<{ locale: 'en' | 'pt' }>()({});
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: IndexRoute.options.component,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      context: { locale: 'en' },
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: /vozcoletiva/i })).toBeInTheDocument();
    expect(screen.getByText(/foundation slice/i)).toBeInTheDocument();
  });
});
