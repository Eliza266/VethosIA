import { test, expect, type Page } from '@playwright/test';
import { loginE2E } from './helpers/auth';
import { ME_VETERINARIO } from './helpers/me-profiles';
import type { MeProfile } from '../src/features/tenant/api';

async function loginAndMockMe(page: Page, profile: Omit<MeProfile, 'uid'>): Promise<void> {
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

test.describe('Smoke clinico principal', () => {
  test('veterinario abre SOAP borrador, aprueba y dispara accion documental', async ({ page }) => {
    const pacienteId = 'pac-principal-smoke';
    const consultaId = 'cons-principal-smoke';
    const now = '2026-06-20T07:00:00.000Z';
    const paciente = {
      id: pacienteId,
      nombre: 'Luna Smoke',
      especie: 'perro',
      raza: 'Mestiza',
      sexo: 'hembra',
      estadoReproductivo: 'esterilizado',
      veterinarioId: 'vet-smoke',
      propietario: {
        nombre: 'Propietario Smoke',
        telefono: '3000000000',
        whatsapp: '3000000000',
        email: 'propietario.smoke@example.com',
      },
      creadoEn: now,
    };
    const consulta = {
      id: consultaId,
      pacienteId,
      veterinarioId: 'vet-smoke',
      numeroHC: 'HC-SMOKE-001',
      fechaHora: now,
      creadoEn: now,
      motivo: 'Control clínico smoke',
      prioridad: 'rutina',
      estado: 'borrador',
      signosVitales: { peso: 12.4, temperatura: 38.2 },
      transcripcion: 'Paciente estable, apetito normal.',
      soap: {
        subjetivo: 'Propietario reporta evolución favorable.',
        objetivo: 'Paciente alerta, mucosas rosadas.',
        analisis: 'Control preventivo sin hallazgos de alarma.',
        plan: 'Continuar vigilancia y control anual.',
        generadoPorIA: true,
      },
      diagnosticoEstructurado: [],
    };
    const consultaAprobada = { ...consulta, estado: 'aprobada' };

    await page.route(`**/v1/pacientes/${pacienteId}`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paciente) });
    });
    await page.route(`**/v1/consultas/${consultaId}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(consulta) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.route(`**/v1/consultas/${consultaId}/aprobar`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(consultaAprobada) });
    });
    await page.route(`**/v1/consultas/${consultaId}/pdf`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: `/v1/consultas/${consultaId}/pdf/download` }),
      });
    });
    await page.route(`**/v1/consultas/${consultaId}/pdf/download`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: '%PDF-1.4\n% smoke\n',
      });
    });

    await loginAndMockMe(page, ME_VETERINARIO);
    await page.goto(`/pacientes/${pacienteId}/consultas/${consultaId}`);

    await expect(page.getByRole('heading', { name: /Historia Cl[ií]nica/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Nota M[eé]dica SOAP/i })).toBeVisible();
    await expect(page.getByText(/Control cl[ií]nico smoke/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Aprobar Consulta/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Descargar PDF/i })).toHaveCount(0);

    const aprobarResponse = page.waitForResponse(
      (r) => r.url().includes(`/v1/consultas/${consultaId}/aprobar`) && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /Aprobar Consulta/i }).click();
    await expect((await aprobarResponse).ok()).toBeTruthy();
    await expect(page.getByRole('button', { name: /Descargar PDF/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Enviar por Email/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /WhatsApp/i })).toBeVisible();

    const pdfResponse = page.waitForResponse(
      (r) => r.url().includes(`/v1/consultas/${consultaId}/pdf`) && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /Descargar PDF/i }).click();
    await expect((await pdfResponse).ok()).toBeTruthy();
  });
});
