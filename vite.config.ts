import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/infiniteSudoku/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'Infinite Sudoku',
        short_name: 'Sudoku',
        description: 'Endless, fair, ad-free sudoku.',
        theme_color: '#f5f3ee',
        background_color: '#f5f3ee',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/infiniteSudoku/',
        scope: '/infiniteSudoku/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'] },
    }),
  ],
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts'] },
})
