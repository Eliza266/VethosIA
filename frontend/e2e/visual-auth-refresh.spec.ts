import { expect } from '@playwright/test';
import {
  assertEmailDemoSafe,
  assertRouteBlocked,
  capture,
  createAuthedTest,
  discoverConsultaPath,
  ensureScreenshotDir,
  getDemoCredentials,
  loginDemoUI,
  saveStorageState,
  skipIfMissingCreds,
} from './helpers/visual-auth';

ensureScreenshotDir();

const testVet = createAuthedTest('veterinario');
const testAdminVet = createAuthedTest('admin_veterinaria');
const testAdminEntidad = createAuthedTest('admin_entidad');
const testSuperadmin = createAuthedTest('superadmin');

// ── Veterinario ──────────────────────────────────────────────────────

testVet.describe.serial('Visual auth · veterinario', () => {
  testVet('login UI + storageState', async ({ page }, testInfo) => {
    const creds = skipIfMissingCreds(testInfo, 'veterinario');
    if (!creds) return;
    await loginDemoUI(page, creds);
    await saveStorageState(page, 'veterinario');
    await expect(page).not.toHaveURL(/\/login/);
  });

  testVet('dashboard desktop 1440', async ({ authedPage: page }) => {
    await page.goto('/');
    await capture(page, 'veterinario-01-dashboard-desktop-1440.png', { width: 1440, height: 900 });
  });

  testVet('dashboard mobile 390', async ({ authedPage: page }) => {
    await page.goto('/');
    await capture(page, 'veterinario-02-dashboard-mobile-390.png', { width: 390, height: 844 });
  });

  testVet('dashboard tablet 768', async ({ authedPage: page }) => {
    await page.goto('/');
    await capture(page, 'veterinario-03-dashboard-tablet-768.png', { width: 768, height: 1024 });
  });

  testVet('pacientes', async ({ authedPage: page }) => {
    await page.goto('/pacientes');
    await capture(page, 'veterinario-04-pacientes-desktop-1440.png', { width: 1440, height: 900 });
  });

  testVet('agenda', async ({ authedPage: page }) => {
    await page.goto('/agenda');
    await capture(page, 'veterinario-05-agenda-desktop-1440.png', { width: 1440, height: 900 });
  });

  testVet('vacunas', async ({ authedPage: page }) => {
    await page.goto('/vacunas');
    await capture(page, 'veterinario-06-vacunas-desktop-1440.png', { width: 1440, height: 900 });
  });

  testVet('brigadas', async ({ authedPage: page }) => {
    await page.goto('/brigadas');
    await capture(page, 'veterinario-07-brigadas-desktop-1440.png', { width: 1440, height: 900 });
  });

  testVet('detalle SOAP borrador si existe', async ({ authedPage: page }) => {
    const href = await discoverConsultaPath(page, 'borrador', getDemoCredentials('veterinario'));
    expect(href, 'Debe existir consulta demo en borrador para cobertura SOAP visual').toBeTruthy();
    await page.goto(href);
    await expect(page.getByText(/borrador/i).first()).toBeVisible({ timeout: 15_000 });
    await capture(page, 'veterinario-soap-borrador-desktop.png', { width: 1440, height: 900 });
  });

  testVet('detalle SOAP aprobada + acciones PDF/WhatsApp/Email demo', async ({ authedPage: page }) => {
    const href = await discoverConsultaPath(page, 'aprobada', getDemoCredentials('veterinario'));
    expect(href, 'Debe existir consulta demo aprobada para cobertura SOAP visual').toBeTruthy();
    await page.goto(href);
    await expect(page.getByText(/aprobada/i).first()).toBeVisible({ timeout: 15_000 });
    await capture(page, 'veterinario-soap-aprobada-desktop.png', { width: 1440, height: 900 });
    await expect(page.getByRole('button', { name: /descargar pdf/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /whatsapp/i })).toBeVisible();
    await capture(page, 'veterinario-soap-aprobada-actions.png', { width: 1440, height: 900 });
    await capture(page, 'veterinario-soap-mobile-390.png', { width: 390, height: 844 });
    await assertEmailDemoSafe(page);
    await capture(page, 'veterinario-12-soap-aprobada-email-demo-toast.png', { width: 1440, height: 900 });
  });

  testVet('RBAC: bloqueo /admin y /entidad', async ({ authedPage: page }) => {
    const creds = getDemoCredentials('veterinario');
    await assertRouteBlocked(page, '/admin', 'veterinario → /admin', creds);
    await assertRouteBlocked(page, '/entidad', 'veterinario → /entidad', creds);
  });
});

// ── Admin Veterinaria ────────────────────────────────────────────────

testAdminVet.describe.serial('Visual auth · admin_veterinaria', () => {
  testAdminVet('login UI + storageState', async ({ page }, testInfo) => {
    const creds = skipIfMissingCreds(testInfo, 'admin_veterinaria');
    if (!creds) return;
    await loginDemoUI(page, creds);
    await saveStorageState(page, 'admin_veterinaria');
  });

  testAdminVet('dashboard desktop', async ({ authedPage: page }) => {
    await page.goto('/');
    await capture(page, 'admin-vet-01-dashboard-desktop-1440.png', { width: 1440, height: 900 });
  });

  testAdminVet('mi veterinaria /veterinaria', async ({ authedPage: page }) => {
    await page.goto('/veterinaria');
    await capture(page, 'admin-vet-02-veterinaria-desktop-1440.png', { width: 1440, height: 900 });
  });

  testAdminVet('pacientes', async ({ authedPage: page }) => {
    await page.goto('/pacientes');
    await capture(page, 'admin-vet-03-pacientes-desktop-1440.png', { width: 1440, height: 900 });
  });

  testAdminVet('suscripcion / consumo', async ({ authedPage: page }) => {
    await page.goto('/suscripcion');
    await capture(page, 'admin-vet-04-suscripcion-desktop-1440.png', { width: 1440, height: 900 });
  });

  testAdminVet('brigadas si accesible', async ({ authedPage: page }) => {
    await page.goto('/brigadas');
    if (!/\/brigadas/.test(page.url())) return;
    await capture(page, 'admin-vet-05-brigadas-desktop-1440.png', { width: 1440, height: 900 });
  });

  testAdminVet('RBAC: bloqueo /entidad y /admin', async ({ authedPage: page }) => {
    const creds = getDemoCredentials('admin_veterinaria');
    await assertRouteBlocked(page, '/entidad', 'admin_veterinaria → /entidad', creds);
    await assertRouteBlocked(page, '/admin', 'admin_veterinaria → /admin', creds);
  });
});

// ── Admin Entidad ────────────────────────────────────────────────────

testAdminEntidad.describe.serial('Visual auth · admin_entidad', () => {
  testAdminEntidad('login UI + storageState', async ({ page }, testInfo) => {
    const creds = skipIfMissingCreds(testInfo, 'admin_entidad');
    if (!creds) return;
    await loginDemoUI(page, creds);
    await saveStorageState(page, 'admin_entidad');
  });

  testAdminEntidad('vista /entidad', async ({ authedPage: page }) => {
    await page.goto('/entidad');
    await capture(page, 'admin-entidad-01-entidad-desktop-1440.png', { width: 1440, height: 900 });
  });

  testAdminEntidad('dashboard', async ({ authedPage: page }) => {
    await page.goto('/');
    await capture(page, 'admin-entidad-02-dashboard-desktop-1440.png', { width: 1440, height: 900 });
  });

  testAdminEntidad('suscripcion / consumo', async ({ authedPage: page }) => {
    await page.goto('/suscripcion');
    await capture(page, 'admin-entidad-03-suscripcion-desktop-1440.png', { width: 1440, height: 900 });
  });

  testAdminEntidad('brigadas', async ({ authedPage: page }) => {
    await page.goto('/brigadas');
    await capture(page, 'admin-entidad-04-brigadas-desktop-1440.png', { width: 1440, height: 900 });
  });

  testAdminEntidad('RBAC: bloqueo /admin y /veterinaria', async ({ authedPage: page }) => {
    const creds = getDemoCredentials('admin_entidad');
    await assertRouteBlocked(page, '/admin', 'admin_entidad → /admin', creds);
    await assertRouteBlocked(page, '/veterinaria', 'admin_entidad → /veterinaria', creds);
  });
});

// ── Superadmin ───────────────────────────────────────────────────────

testSuperadmin.describe.serial('Visual auth · superadmin', () => {
  testSuperadmin('login UI + storageState', async ({ page }, testInfo) => {
    const creds = skipIfMissingCreds(testInfo, 'superadmin');
    if (!creds) return;
    await loginDemoUI(page, creds);
    await saveStorageState(page, 'superadmin');
  });

  testSuperadmin('/admin soporte plataforma', async ({ authedPage: page }) => {
    await page.goto('/admin');
    await capture(page, 'superadmin-01-admin-desktop-1440.png', { width: 1440, height: 900 });
  });

  testSuperadmin('planes (modulo reservado)', async ({ authedPage: page }) => {
    await page.goto('/planes');
    await capture(page, 'superadmin-02-planes-desktop-1440.png', { width: 1440, height: 900 });
  });

  testSuperadmin('suscripciones (modulo reservado)', async ({ authedPage: page }) => {
    await page.goto('/suscripciones');
    await capture(page, 'superadmin-03-suscripciones-desktop-1440.png', { width: 1440, height: 900 });
  });

  testSuperadmin('auditoria (modulo reservado)', async ({ authedPage: page }) => {
    await page.goto('/auditoria');
    await capture(page, 'superadmin-04-auditoria-desktop-1440.png', { width: 1440, height: 900 });
  });

  testSuperadmin('configuracion (modulo reservado)', async ({ authedPage: page }) => {
    await page.goto('/configuracion');
    await capture(page, 'superadmin-05-configuracion-desktop-1440.png', { width: 1440, height: 900 });
  });

  testSuperadmin('RBAC: bloqueo rutas tenant /entidad /veterinaria /brigadas', async ({ authedPage: page }) => {
    const creds = getDemoCredentials('superadmin');
    await assertRouteBlocked(page, '/entidad', 'superadmin → /entidad', creds);
    await assertRouteBlocked(page, '/veterinaria', 'superadmin → /veterinaria', creds);
    await assertRouteBlocked(page, '/brigadas', 'superadmin → /brigadas', creds);
  });
});
