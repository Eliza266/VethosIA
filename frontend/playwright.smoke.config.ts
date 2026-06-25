import { defineConfig, devices } from '@playwright/test';

// Config E2E "smoke" SIN emuladores: valida que la SPA rediseñada monta en un
// navegador real y que el login publico se renderiza. No requiere Firebase
// emulators ni API local (a diferencia de playwright.config.ts, que cubre los
// flujos clinicos autenticados). Util para verificar el nuevo shell (sidebar)
// en local sin levantar todo el stack.
const PORT = 5175;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: /smoke\.spec\.ts/,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      VITE_API_BASE_URL: '',
      VITE_FIREBASE_API_KEY: 'fake-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'vethosia-production.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'vethosia-production',
      VITE_FIREBASE_STORAGE_BUCKET: 'vethosia-production.firebasestorage.app',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
    },
  },
});
