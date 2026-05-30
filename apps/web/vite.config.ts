import { lingui } from '@lingui/vite-plugin';
import tailwind from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // amazon-cognito-identity-js → buffer expects Node's `global`. Map it to
  // `globalThis` for the browser.
  define: {
    global: 'globalThis',
  },
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react({ babel: { plugins: ['macros'] } }),
    lingui(),
    tailwind(),
    VitePWA({
      registerType: 'autoUpdate',
      // Whenever MSW runs (full mock OR the comms-hybrid), its service worker
      // must be the sole controller of scope `/` — otherwise Workbox's sw.js
      // wins, MSW never intercepts, and the conflicting workers also break the
      // real-API auth calls. `selfDestroying` ships a SW that unregisters itself
      // + any previously-installed Workbox SW, so returning visitors aren't
      // stuck on a stale precache worker. MSW's own worker remains and satisfies
      // PWA installability.
      selfDestroying:
        process.env.VITE_USE_MOCKS === '1' || process.env.VITE_MOCK_COMMS === '1',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'vozcoletiva',
        short_name: 'vozcoletiva',
        description: 'Structured collective decision-making.',
        theme_color: '#5B5BE0',
        background_color: '#0F1216',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['**/mockServiceWorker.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/mockServiceWorker\.js$/],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 5173,
  },
});
