import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The app asks before reloading so a running game is never interrupted.
      registerType: 'prompt',
      // public/ is covered by globPatterns below; don't list the icons a second time.
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'Sudoku',
        short_name: 'Sudoku',
        description: 'Sudoku with hints, notes and a daily puzzle.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f5f1',
        theme_color: '#f6f5f1',
        categories: ['games', 'puzzle'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell, the generator worker and all locales are precached, so classic mode
        // works fully offline. API calls go to another origin and are never cached.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  worker: { format: 'es' },
  server: { port: 5173 },
});
