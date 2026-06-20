import { test, expect } from '@playwright/test';

// Smoke E2E: la SPA monta y la pantalla de login publica se renderiza.
// Los flujos clinicos completos viven en specs con Auth/API/emuladores.
test('la app carga y redirige a login cuando no hay sesión', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/login/);
  await expect(page.getByRole('button', { name: /Iniciar sesión con Google/i })).toBeVisible();
});

test('la pantalla de login muestra la propuesta de valor actual', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Historias clínicas inteligentes/i })).toBeVisible();
  await expect(page.getByText(/SOAP automático|estructura SOAP/i).first()).toBeVisible();
});

test('el login ofrece email+password, Google y recuperación (PDF 07.A)', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
  await expect(page.getByRole('button', { name: /Iniciar sesión$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Iniciar sesión con Google/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Olvidaste tu contraseña/i })).toBeVisible();
  await page.getByRole('button', { name: /Crear una cuenta/i }).click();
  await expect(page.getByRole('button', { name: /Crear cuenta/i })).toBeVisible();
});
