import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Required for Capacitor — assets must use relative paths
  base: './',

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [{ urlPattern: /\/muscles\/.*\.(glb|png|jpg)$/, handler: 'CacheFirst', options: { cacheName: 'anatomy-shared-v3', expiration: { maxEntries: 32, maxAgeSeconds: 365 * 86400 } } }],
        globIgnores: ['muscles/**'],
      },
      manifest: {
        name: 'OmniBody — Elite Training',
        short_name: 'OmniBody',
        description: 'Comprehensive Training & Nutrition System',
        theme_color: '#172332',
        background_color: '#172332',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],

  build: {
    sourcemap: true,
  },
});
