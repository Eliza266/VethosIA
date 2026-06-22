import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const DEFAULT_PROD_API_BASE_URL = 'https://vetia-api-awdlgzrxkq-uc.a.run.app'
const DEFAULT_DEV_API_PROXY_TARGET = 'http://127.0.0.1:8081'

function loadPublicProdDefaults(mode: string) {
  if (mode === 'production' && !process.env.VITE_API_BASE_URL) {
    process.env.VITE_API_BASE_URL = DEFAULT_PROD_API_BASE_URL
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  loadPublicProdDefaults(mode)
  const devApiProxyTarget = process.env.DEV_API_PROXY_TARGET || DEFAULT_DEV_API_PROXY_TARGET

  return {
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Vethos AI - Notas Clínicas Veterinarias',
        short_name: 'Vethos AI',
        description: 'Historias clínicas veterinarias con IA: graba, transcribe y estructura en SOAP.',
        theme_color: '#0f6e56',
        background_color: '#0a0f1a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'es',
        icons: [
          { src: '/icons/icon.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // datos GET de la API: stale-while-revalidate para que la app abra offline
            urlPattern: ({ url }) => url.pathname.startsWith('/v1') && url.search === '',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'vetia-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    // Dev/E2E: mismo origen evita CORS cuando VITE_API_BASE_URL está vacío.
    proxy: {
      '/v1': {
        target: devApiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  }
})
