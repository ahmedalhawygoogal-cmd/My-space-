import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type PluginOption } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const native = process.env.CAPACITOR === '1'
const root = path.dirname(fileURLToPath(import.meta.url))

const plugins: PluginOption[] = [react()]
if (!native) {
  plugins.push(
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'MySpace',
        short_name: 'MySpace',
        description: 'Study and productivity workspace',
        theme_color: '#0F6E6B',
        background_color: '#F4F1EA',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon.png',
            sizes: '1600x1600',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,png,ico,wasm,webp}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  )
}

export default defineConfig({
  plugins,
  resolve: native
    ? {
        alias: {
          'virtual:pwa-register': path.join(root, 'src/pwa-register-stub.ts'),
        },
      }
    : undefined,
  build: {
    minify: true,
    sourcemap: false,
    cssMinify: true,
    chunkSizeWarningLimit: 700,
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.monkeycode-ai.live'],
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['.monkeycode-ai.live'],
  },
})
