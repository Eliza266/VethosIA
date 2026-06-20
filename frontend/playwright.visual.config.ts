import { defineConfig, devices } from '@playwright/test';

const LOCAL_PORT = 5175;
const BASE_URL = process.env.E2E_BASE_URL?.trim() || `http://127.0.0.1:${LOCAL_PORT}`;
const isLocalTarget = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/i.test(BASE_URL);

function resolveLocalDevPort(baseUrl: string): number {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.port) return Number(parsed.port);
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return LOCAL_PORT;
  }
}

const localDevPort = isLocalTarget ? resolveLocalDevPort(BASE_URL) : LOCAL_PORT;

/**
 * Playwright visual smoke (público + auth por rol).
 * Producción: E2E_BASE_URL=https://vethosia-production.web.app + credenciales demo en env.
 * Local: dev server en :5175 si no hay E2E_BASE_URL remoto.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['visual-refresh.spec.ts', 'visual-auth-refresh.spec.ts'],
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(isLocalTarget
    ? {
        webServer: {
          command: `npm run dev -- --port ${localDevPort} --strictPort --host 127.0.0.1`,
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 120_000,
          env: {
            ...process.env,
            VITE_EMAIL_REAL_ENABLED: process.env.VITE_EMAIL_REAL_ENABLED ?? 'false',
          },
        },
      }
    : {}),
});
