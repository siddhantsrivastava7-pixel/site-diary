import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/app-icon.svg', 'illustrations/*.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Site Diary — Daily Manpower',
        short_name: 'Site Diary',
        description: 'A cheerful, simple daily workforce notebook for construction sites.',
        theme_color: '#fffbf5',
        background_color: '#fffbf5',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: { navigateFallback: '/index.html', globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'] },
      devOptions: { enabled: false }
    })
  ]
});
