import { defineConfig, devices } from '@playwright/test';

// Puerto dedicado para E2E: evita colisiÃ³n con `npm run dev` en :5173 y garantiza
// que Vite arranca con los feature flags tenant (VITE_USE_API_CRUD, etc.).
const E2E_PORT = 5174;
const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

/** Env inyectado al webServer de Vite (Strangler Fig tenant + emuladores). */
const e2eWebEnv: Record<string, string> = {
  VITE_USE_FIREBASE_EMULATORS: 'true',
  // VacÃ­o = requests relativas /v1/* vÃ­a proxy de Vite (sin CORS en :5174).
  VITE_API_BASE_URL: '',
  VITE_USE_API_IA: 'true',
  VITE_USE_API_HC: 'true',
  VITE_USE_API_DOCS: 'true',
  VITE_USE_API_CRUD: 'true',
  VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY ?? 'fake-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'vethosia-production.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID ?? 'vethosia-production',
  VITE_FIREBASE_STORAGE_BUCKET:
    process.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'vethosia-production.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '000000000000',
  VITE_FIREBASE_APP_ID:
    process.env.VITE_FIREBASE_APP_ID ?? '1:000000000000:web:0000000000000000000000',
  VITE_WHATSAPP_COUNTRY_CODE: process.env.VITE_WHATSAPP_COUNTRY_CODE ?? '57',
};

// Config de Playwright para los e2e. Levanta Vite en :5174 con flags tenant.
// Requiere emuladores Firebase + API :8081 + `npm run seed:e2e-local` en api/.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT} --strictPort --host 127.0.0.1`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: e2eWebEnv,
  },
});
