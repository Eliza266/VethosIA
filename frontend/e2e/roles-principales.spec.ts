import { test, expect } from '@playwright/test';
import { loginE2E } from './helpers/auth';
import {
  ME_ADMIN_ENTIDAD,
  ME_ADMIN_VETERINARIA,
  ME_ASISTENTE_LEGACY,
  ME_SUPERADMIN,
  ME_VETERINARIO,
} from './helpers/me-profiles';
import type { MeProfile } from '../src/features/tenant/api';

const ME_ROL_INVALIDO = {
  ...ME_VETERINARIO,
  rol: 'sin_permisos',
  role: null,
  nombre: 'Usuario E2E Sin Permisos',
} as unknown as Omit<MeProfile, 'uid'>;

async function loginAndMockMe(
  page: import('@playwright/test').Page,
  profile: Omit<MeProfile, 'uid'>,
): Promise<void> {
  const mePromise = page.waitForResponse(
    (r) => r.url().includes('/v1/me') && r.request().method() === 'GET' && r.ok(),
    { timeout: 15_000 },
  );
  await loginE2E(page);
  const realMe = (await (await mePromise).json()) as MeProfile;
  const mocked: MeProfile = { ...profile, uid: realMe.uid, email: realMe.email ?? profile.email };

  await page.route('**/v1/me', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mocked),
    });
  });
  await page.reload();
}

function nav(page: import('@playwright/test').Page) {
  return page.locator('nav');
}

test.describe('E2E roles principales canonicos (R118/R121)', () => {
  test('veterinario ve flujo clinico operativo', async ({ page }) => {
    await loginAndMockMe(page, ME_VETERINARIO);
    const navbar = nav(page);
    await expect(navbar.getByRole('link', { name: 'Pacientes', exact: true })).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Agenda', exact: true })).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Brigadas', exact: true })).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Nuevo paciente', exact: true })).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Vista entidad' })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: /Suscripci[oó]n/i })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: /Soporte plataforma/i })).toHaveCount(0);
  });

  test('asistente legacy no aparece como rol principal ni ve acciones criticas', async ({ page }) => {
    await loginAndMockMe(page, ME_ASISTENTE_LEGACY);
    await page.route('**/v1/consultas/cons-e2e-asistente', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cons-e2e-asistente',
          pacienteId: 'pac-e2e',
          estado: 'borrador',
          soap: { subjetivo: 'Paciente con vomito', objetivo: 'Deshidratacion leve' },
          transcripcion: 'Paciente con vomito',
        }),
      });
    });
    await page.route('**/v1/pacientes/pac-e2e', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'pac-e2e',
          nombre: 'Firulais E2E',
          propietario: { nombre: 'Dueno', telefono: '3001234567' },
        }),
      });
    });

    const navbar = nav(page);
    await expect(navbar.getByRole('link', { name: 'Pacientes', exact: true })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: 'Agenda', exact: true })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: 'Nuevo paciente', exact: true })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: /Veterinarias/i })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: /Suscripci[oó]n/i })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: /Soporte plataforma/i })).toHaveCount(0);

    await expect(page.getByText('Rol legacy', { exact: true })).toBeVisible();

    // Deep-link clinico fail-closed: asistente legacy vuelve al dashboard sin acciones criticas.
    await page.goto('/pacientes/pac-e2e/consultas/cons-e2e-asistente');
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Aprobar Consulta/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Eliminar/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Descargar PDF/i })).toHaveCount(0);
  });

  test('admin_entidad accede a vista entidad y no ve soporte plataforma', async ({ page }) => {
    await loginAndMockMe(page, ME_ADMIN_ENTIDAD);
    const navbar = nav(page);
    await expect(navbar.getByRole('link', { name: 'Vista entidad', exact: true })).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Sedes', exact: true })).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Brigadas', exact: true })).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Veterinarias', exact: true })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: 'Pacientes', exact: true })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: 'Agenda', exact: true })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: 'Vacunas', exact: true })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: /Suscripci[oó]n/i })).toBeVisible();
    await expect(navbar.getByRole('link', { name: /Soporte plataforma/i })).toHaveCount(0);

    await page.route('**/v1/brigadas', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/v1/backoffice/veterinarias', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/v1/backoffice/miembros', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.goto('/brigadas');
    await expect(page).toHaveURL(/\/brigadas/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /^Brigadas$/i })).toBeVisible();

    await page.goto('/entidad');
    await expect(page).toHaveURL(/\/entidad/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Vista entidad/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Operaci[oó]n plataforma/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Crear entidad$/i })).toHaveCount(0);

    await page.goto('/veterinaria');
    await expect(page).toHaveURL(/\/entidad$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Vista entidad/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Mi veterinaria/i })).toHaveCount(0);
  });

  test('admin_veterinaria accede a modulos de veterinaria', async ({ page }) => {
    await loginAndMockMe(page, ME_ADMIN_VETERINARIA);
    const navbar = nav(page);
    await expect(navbar.getByRole('link', { name: 'Veterinarias', exact: true })).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Pacientes', exact: true })).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Brigadas', exact: true })).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Vista entidad' })).toHaveCount(0);

    await page.goto('/veterinaria');
    await expect(page).toHaveURL(/\/veterinaria/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Operaci[oó]n plataforma/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Crear sede$/i })).toHaveCount(0);
  });

  test('superadmin queda en soporte/plataforma y no entra a rutas tenant', async ({ page }) => {
    await loginAndMockMe(page, ME_SUPERADMIN);
    const navbar = nav(page);
    await expect(navbar.getByRole('link', { name: /Soporte plataforma/i })).toBeVisible();
    await expect(navbar.getByRole('link', { name: 'Pacientes' })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: 'Brigadas' })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: 'Vista entidad' })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: 'Veterinarias', exact: true })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: /Suscripci[oó]n/i })).toHaveCount(0);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Operaci[oó]n plataforma/i })).toBeVisible();
    await expect(page.getByText(/No opera cl[ií]nica tenant/i)).toBeVisible();
    const superAdminModules = page.getByRole('navigation', { name: /M[oó]dulos Super Admin/i });
    await expect(superAdminModules.getByRole('link', { name: /Entidades/i })).toBeVisible();
    await expect(superAdminModules.getByRole('link', { name: /Veterinarias/i })).toBeVisible();
    await expect(superAdminModules.getByRole('link', { name: /Usuarios/i })).toBeVisible();
    await expect(superAdminModules.getByRole('link', { name: /Planes/i })).toBeVisible();
    await expect(superAdminModules.getByRole('link', { name: /Auditor[ií]a/i })).toBeVisible();

    await page.goto('/admin?panel=entidades');
    await expect(page.getByRole('button', { name: /^Crear entidad$/i })).toBeVisible();
    await page.goto('/admin?panel=veterinarias');
    await expect(page.getByRole('button', { name: /^Crear sede$/i })).toBeVisible();
    await page.goto('/admin?panel=usuarios');
    await expect(page.getByRole('heading', { name: /Usuarios y miembros/i })).toBeVisible();

    await page.goto('/entidad');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });

    await page.goto('/veterinaria');
    await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });

    await page.goto('/brigadas');
    await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 });
  });

  test('rol invalido queda fail-closed sin navegacion critica', async ({ page }) => {
    await loginAndMockMe(page, ME_ROL_INVALIDO);

    await expect(page.getByTestId('dashboard-fallback')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Rol sin centro operativo habilitado/i })).toBeVisible();
    const navbar = nav(page);
    await expect(navbar.getByRole('link', { name: 'Pacientes', exact: true })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: 'Agenda', exact: true })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: /Soporte plataforma/i })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: /Vista entidad/i })).toHaveCount(0);
    await expect(navbar.getByRole('link', { name: /Veterinarias/i })).toHaveCount(0);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
    await page.goto('/pacientes');
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
    await page.goto('/entidad');
    await expect(page).toHaveURL(/\/$/, { timeout: 10_000 });
  });
});
