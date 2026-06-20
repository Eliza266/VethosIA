import { expect, test as base, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const SCREENSHOT_AUTH_DIR = path.join(process.cwd(), 'e2e-screenshots', 'visual-refresh-auth');
export const AUTH_STATE_DIR = path.join(process.cwd(), '.auth');

export type DemoRoleId = 'veterinario' | 'admin_veterinaria' | 'admin_entidad' | 'superadmin';

const ROLE_ENV: Record<DemoRoleId, { email: string; password: string }> = {
  veterinario: {
    email: 'E2E_DEMO_VETERINARIO_EMAIL',
    password: 'E2E_DEMO_VETERINARIO_PASSWORD',
  },
  admin_veterinaria: {
    email: 'E2E_DEMO_ADMIN_VET_EMAIL',
    password: 'E2E_DEMO_ADMIN_VET_PASSWORD',
  },
  admin_entidad: {
    email: 'E2E_DEMO_ADMIN_ENTIDAD_EMAIL',
    password: 'E2E_DEMO_ADMIN_ENTIDAD_PASSWORD',
  },
  superadmin: {
    email: 'E2E_DEMO_SUPERADMIN_EMAIL',
    password: 'E2E_DEMO_SUPERADMIN_PASSWORD',
  },
};

const DEFAULT_DEMO_CONSULTAS: Record<
  'borrador' | 'aprobada',
  { pacienteId: string; consultaId: string; pacienteEnv: string; consultaEnv: string }
> = {
  borrador: {
    pacienteId: 'pac_demo_live_max',
    consultaId: 'cons_demo_live_max_borrador',
    pacienteEnv: 'E2E_DEMO_PACIENTE_BORRADOR_ID',
    consultaEnv: 'E2E_DEMO_CONSULTA_BORRADOR_ID',
  },
  aprobada: {
    pacienteId: 'pac_demo_live_luna',
    consultaId: 'cons_demo_live_luna_aprobada',
    pacienteEnv: 'E2E_DEMO_PACIENTE_APROBADA_ID',
    consultaEnv: 'E2E_DEMO_CONSULTA_APROBADA_ID',
  },
};

export interface DemoCredentials {
  email: string;
  password: string;
}

export function authStatePath(role: DemoRoleId): string {
  return path.join(AUTH_STATE_DIR, `${role}.json`);
}

export function missingCredentialsMessage(role: DemoRoleId): string | null {
  const creds = getDemoCredentials(role);
  if (creds) return null;
  const keys = ROLE_ENV[role];
  return `Credenciales demo no configuradas. Define ${keys.email} y ${keys.password} (sin commitear valores).`;
}

export function getDemoCredentials(role: DemoRoleId): DemoCredentials | null {
  const keys = ROLE_ENV[role];
  const email = process.env[keys.email]?.trim();
  const password = process.env[keys.password]?.trim();
  if (!email || !password) return null;
  return { email, password };
}

export function ensureScreenshotDir(): void {
  fs.mkdirSync(SCREENSHOT_AUTH_DIR, { recursive: true });
}

export function ensureAuthDir(): void {
  fs.mkdirSync(AUTH_STATE_DIR, { recursive: true });
}

export async function loginDemoUI(page: Page, creds: DemoCredentials): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/Correo electr.nico/i).fill(creds.email);
  await page.getByLabel(/Contrase.a/i).fill(creds.password);
  await page.getByRole('button', { name: /^Iniciar sesi.n$/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 45_000 });
  await expect(page.getByRole('navigation')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('main')).toBeVisible({ timeout: 30_000 });
}

export async function saveStorageState(page: Page, role: DemoRoleId): Promise<void> {
  ensureAuthDir();
  await page.context().storageState({ path: authStatePath(role) });
}

export async function capture(
  page: Page,
  filename: string,
  viewport?: { width: number; height: number },
): Promise<void> {
  ensureScreenshotDir();
  if (viewport) await page.setViewportSize(viewport);
  await page.waitForLoadState('domcontentloaded');
  await page
    .waitForFunction(
      () => {
        const text = document.body.innerText.trim();
        const isOnlySessionLoading = /^Cargando sesi.n\.\.\.$/i.test(text);
        const hasBlockingSpinner = /Cargando sesi.n|Cargando panel|Cargando consulta|Buscando expedientes/i.test(text);
        return text.length > 40 && !isOnlySessionLoading && !hasBlockingSpinner;
      },
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  await page
    .waitForFunction(async () => {
      window.scrollTo({ top: 0, left: 0 });
      if ('fonts' in document) {
        await (document as Document & { fonts: FontFaceSet }).fonts.ready;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return true;
    })
    .catch(() => undefined);
  await page.screenshot({
    path: path.join(SCREENSHOT_AUTH_DIR, filename),
    fullPage: true,
  });
}

export async function assertRouteBlocked(
  page: Page,
  targetPath: string,
  label: string,
  creds?: DemoCredentials | null,
): Promise<void> {
  const forbidden = targetPath.replace(/\/$/, '') || targetPath;

  await page.goto('/');
  if (/\/login(?:\?|$)/.test(page.url()) && creds) {
    await loginDemoUI(page, creds);
  }
  await expect(page, `${label}: sesion activa en dashboard`).not.toHaveURL(/\/login(?:\?|$)/, {
    timeout: 20_000,
  });

  await page.goto(targetPath);
  await page.waitForLoadState('domcontentloaded');
  await page
    .waitForFunction(
      () => !/Cargando sesi.n|Cargando/i.test(document.body.innerText),
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(300);

  const url = page.url();
  expect(url, `${label}: no debe permanecer en ruta protegida`).not.toContain(forbidden);

  const bodyText = (await page.locator('body').innerText()).trim();
  expect(bodyText.length, `${label}: pantalla no debe estar en blanco`).toBeGreaterThan(0);
}

function directDemoConsultaPath(estado: 'borrador' | 'aprobada'): string {
  const defaults = DEFAULT_DEMO_CONSULTAS[estado];
  const pacienteId = process.env[defaults.pacienteEnv]?.trim() || defaults.pacienteId;
  const consultaId = process.env[defaults.consultaEnv]?.trim() || defaults.consultaId;
  return `/pacientes/${pacienteId}/consultas/${consultaId}`;
}

async function ensureLoggedInIfNeeded(page: Page, creds?: DemoCredentials | null): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const text = document.body.innerText.trim();
        const loadingSession = /^Cargando sesi.n\.\.\.$/i.test(text);
        return !loadingSession || /\/login(?:\?|$)/.test(window.location.pathname);
      },
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => undefined);
  if (/\/login(?:\?|$)/.test(page.url()) && creds) {
    await loginDemoUI(page, creds);
    return;
  }

  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (/^Cargando sesi.n\.\.\.$/i.test(bodyText.trim()) && creds) {
    await loginDemoUI(page, creds);
  }
}

async function isConsultaPathValid(
  page: Page,
  href: string,
  estado: 'borrador' | 'aprobada',
  creds?: DemoCredentials | null,
): Promise<boolean> {
  await page.goto(href);
  await page.waitForLoadState('domcontentloaded');
  await ensureLoggedInIfNeeded(page, creds);
  if (!page.url().includes(href)) {
    await page.goto(href);
    await page.waitForLoadState('domcontentloaded');
  }

  await page
    .waitForFunction(
      () => /Historia Cl.nica|Error al cargar/i.test(document.body.innerText),
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => undefined);
  const bodyText = await page.locator('body').innerText();
  if (!/historia cl.nica/i.test(bodyText)) return false;
  const expectedEstado = estado === 'aprobada' ? /aprobada/i : /borrador/i;
  return expectedEstado.test(bodyText);
}

export async function discoverConsultaPath(
  page: Page,
  estado: 'borrador' | 'aprobada',
  creds?: DemoCredentials | null,
): Promise<string | null> {
  const directHref = directDemoConsultaPath(estado);
  if (await isConsultaPathValid(page, directHref, estado, creds)) return directHref;

  await page.goto('/pacientes');
  await page.waitForLoadState('domcontentloaded');
  await ensureLoggedInIfNeeded(page, creds);
  if (!page.url().includes('/pacientes')) {
    await page.goto('/pacientes');
    await page.waitForLoadState('domcontentloaded');
  }

  const heading = page.getByRole('heading', { name: /^Pacientes$/i });
  if ((await heading.count()) === 0) return null;

  const badge = estado === 'aprobada' ? /Completado|Aprobada/i : /Borrador/i;
  const patientLinks = page.locator('a[href^="/pacientes/"]:not([href*="/nuevo"])');
  const total = await patientLinks.count();

  for (let i = 0; i < Math.min(total, 12); i++) {
    const href = await patientLinks.nth(i).getAttribute('href');
    if (!href || href.includes('/consultas/')) continue;
    await page.goto(href);
    await page.waitForLoadState('domcontentloaded');

    const consultaLink = page
      .locator('a[href*="/consultas/"]')
      .filter({ has: page.getByText(badge) })
      .first();

    if ((await consultaLink.count()) > 0) {
      const consultaHref = await consultaLink.getAttribute('href');
      if (consultaHref) return consultaHref;
    }
  }
  return null;
}

export async function assertEmailDemoSafe(page: Page): Promise<void> {
  const emailPosts: string[] = [];
  const onRequest = (req: { url: () => string; method: () => string }) => {
    if (req.method() === 'POST' && /\/email(?:\?|$)/i.test(req.url())) {
      emailPosts.push(req.url());
    }
  };
  page.on('request', onRequest);
  try {
    const btn = page.getByRole('button', { name: /enviar por email/i });
    await expect(btn).toBeVisible({ timeout: 10_000 });
    await btn.click();
    await expect(page.getByRole('status').filter({ hasText: /correo real pendiente|demo usa pdf/i })).toBeVisible({
      timeout: 8_000,
    });
    expect(emailPosts, 'Email demo no debe llamar POST /email').toHaveLength(0);
  } finally {
    page.off('request', onRequest);
  }
}

export function skipIfMissingCreds(testInfo: TestInfo, role: DemoRoleId): DemoCredentials | null {
  const msg = missingCredentialsMessage(role);
  if (msg) {
    testInfo.skip(true, msg);
    return null;
  }
  return getDemoCredentials(role)!;
}

export function createAuthedTest(role: DemoRoleId) {
  return base.extend<{ authedPage: Page }>({
    authedPage: async ({ browser }, use, testInfo) => {
      const creds = getDemoCredentials(role);
      const msg = missingCredentialsMessage(role);
      if (!creds || msg) {
        testInfo.skip(true, msg ?? 'Credenciales demo no configuradas.');
      }

      ensureAuthDir();
      const statePath = authStatePath(role);
      let context = await browser.newContext(
        fs.existsSync(statePath) ? { storageState: statePath } : undefined,
      );
      let page = await context.newPage();

      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(600);
      const needsLogin = /\/login(?:\?|$)/.test(page.url());
      if (needsLogin) {
        await context.close();
        context = await browser.newContext();
        page = await context.newPage();
        await loginDemoUI(page, creds!);
        await context.storageState({ path: statePath });
      }

      await use(page);
      await context.close();
    },
  });
}
