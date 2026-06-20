import { expect, type Page } from '@playwright/test';

export const E2E_EMAIL = process.env.E2E_EMAIL ?? 'vet@vetia.local';
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'VetIA-Local-2026!';

/** Login email+password contra Auth emulador (requiere seed:e2e-local con GCLOUD_PROJECT alineado). */
export async function loginE2E(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(E2E_EMAIL);
  await page.getByLabel('Contraseña').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: /^Iniciar sesión$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.getByRole('link', { name: /Pacientes|Dashboard|Soporte plataforma/i }).first()).toBeVisible({
    timeout: 15_000,
  });
}
