import { test, expect } from '@playwright/test';
import { loginE2E } from './helpers/auth';

test.describe('E2E flujo clínico crítico R117 (IA mock local)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      class FakeMediaRecorder {
        static isTypeSupported(_mime: string) {
          return true;
        }
        state = 'inactive';
        ondataavailable: ((ev: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        constructor(_stream: unknown, _options?: unknown) {}
        start() {
          this.state = 'recording';
        }
        stop() {
          this.state = 'inactive';
          const blob = new Blob(['fake-audio-e2e'], { type: 'audio/webm' });
          this.ondataavailable?.({ data: blob });
          this.onstop?.();
        }
      }
      // @ts-expect-error mock runtime
      window.MediaRecorder = FakeMediaRecorder;
      navigator.mediaDevices.getUserMedia = async () =>
        ({
          getTracks: () => [{ stop: () => undefined }],
        }) as MediaStream;
    });
  });

  test('login → paciente → consulta IA mock → SOAP → aprobar → PDF', async ({ page }) => {
    test.setTimeout(120_000);

    // 1) Login
    await loginE2E(page);
    await expect(page.getByRole('heading', { name: /Hola, .*(consulta|SOAP|pacientes)/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('link', { name: /Consulta SOAP/i })).toBeVisible();
    await page.screenshot({ path: 'e2e-screenshots/00-dashboard.png', fullPage: true });

    // 2) Dashboard visible
    await expect(page.getByRole('link', { name: /Nuevo Paciente/i }).first()).toBeVisible();

    // 3) Crear paciente (tenant: POST /v1/pacientes con claims orgId del seed)
    await page.goto('/pacientes/nuevo');
    await page.locator('#nombre').fill('Max E2E');
    await page.locator('#propietarioNombre').fill('Dueño E2E');
    await page.locator('#propietarioTelefono').fill('3001234567');
    await page.locator('#propietarioEmail').fill('dueno-e2e@example.com');
    const pacienteApiPromise = page.waitForResponse(
      (r) => r.url().includes('/v1/pacientes') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: /Guardar Paciente/i }).click();
    const pacienteApi = await pacienteApiPromise;
    expect(pacienteApi.ok()).toBeTruthy();
    const pacienteBody = (await pacienteApi.json()) as { id?: string; nombre?: string };
    expect(pacienteBody.id).toBeTruthy();
    expect(pacienteBody.nombre).toBe('Max E2E');
    await expect(page).toHaveURL(new RegExp(`/pacientes/${pacienteBody.id}`), { timeout: 15_000 });
    await expect(page.locator('h1', { hasText: 'Max E2E' })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: 'e2e-screenshots/01-paciente-creado.png', fullPage: true });

    // 4) Nueva consulta + IA mock (tenant: POST /v1/consultas al grabar audio)
    await page.getByRole('link', { name: /Nueva Consulta/i }).click();
    await expect(page.getByText(/Nueva Consulta Automática/i)).toBeVisible({ timeout: 15_000 });
    const consultaApiPromise = page.waitForResponse(
      (r) => r.url().includes('/v1/consultas') && r.request().method() === 'POST' && !r.url().includes('/hc'),
      { timeout: 30_000 },
    );
    await page.getByTitle('Iniciar grabación').click();
    await page.getByTitle('Detener grabación').click();
    const consultaApi = await consultaApiPromise;
    expect(consultaApi.ok()).toBeTruthy();

    // IA mock puede completar muy rápido; validamos resultado en detalle de consulta
    await expect(page.getByText(/Nota M[eé]dica SOAP/i)).toBeVisible({ timeout: 90_000 });
    await expect(page).toHaveURL(/\/pacientes\/[^/]+\/consultas\//);
    await expect(page.getByText(/vómito|gastroenteritis|Max/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.screenshot({ path: 'e2e-screenshots/02-consulta-soap.png', fullPage: true });

    // 6b) Borrador: no exportar PDF hasta aprobar
    await expect(page.getByRole('button', { name: /Descargar PDF/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Aprobar Consulta/i })).toBeVisible();

    // 7) Aprobar vía POST /v1/consultas/:id/aprobar (consumo + auditoría server-side)
    const aprobarApiPromise = page.waitForResponse(
      (r) => r.url().includes('/v1/consultas/') && r.url().endsWith('/aprobar') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: /Aprobar Consulta/i }).click();
    const aprobarApi = await aprobarApiPromise;
    expect(aprobarApi.ok()).toBeTruthy();
    const aprobarBody = (await aprobarApi.json()) as { estado?: string };
    expect(aprobarBody.estado).toBe('aprobada');
    await expect(page.getByRole('button', { name: /Descargar PDF/i })).toBeVisible({ timeout: 15_000 });

    // 8) PDF server-side (VITE_USE_API_DOCS=true → POST /v1/consultas/:id/pdf)
    const pdfApiPromise = page.waitForResponse(
      (r) => r.url().includes('/v1/consultas/') && r.url().endsWith('/pdf') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await page.getByRole('button', { name: /Descargar PDF/i }).click();
    const pdfApi = await pdfApiPromise;
    expect(pdfApi.ok()).toBeTruthy();
    const { url: pdfUrl } = (await pdfApi.json()) as { url: string };
    expect(pdfUrl).toContain('/pdf/download');

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    await page.screenshot({ path: 'e2e-screenshots/03-pdf-server-side.png', fullPage: true });

    // 9) Email demo seguro: con VITE_EMAIL_REAL_ENABLED=false no debe llamar POST /email.
    const emailPosts: string[] = [];
    const onEmailRequest = (req: { url: () => string; method: () => string }) => {
      if (req.method() === 'POST' && /\/email(?:\?|$)/i.test(req.url())) {
        emailPosts.push(req.url());
      }
    };
    page.on('request', onEmailRequest);
    await page.getByRole('button', { name: /Enviar por Email/i }).click();
    await expect(page.getByRole('status').filter({ hasText: /correo real pendiente|demo usa pdf/i })).toBeVisible({
      timeout: 8_000,
    });
    page.off('request', onEmailRequest);
    expect(emailPosts, 'Email demo no debe llamar POST /email').toHaveLength(0);

    await page.screenshot({ path: 'e2e-screenshots/04-email-mock.png', fullPage: true });

    // 10) WhatsApp con PDF server-side (wa.me + URL /pdf/download en el mensaje)
    const waPdfPromise = page.waitForResponse(
      (r) => r.url().includes('/v1/consultas/') && r.url().endsWith('/pdf') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    const waPopupPromise = page.waitForEvent('popup', { timeout: 15_000 });
    await page.getByRole('button', { name: /^WhatsApp$/i }).click();
    const waPdfApi = await waPdfPromise;
    expect(waPdfApi.ok()).toBeTruthy();
    const { url: waPdfUrl } = (await waPdfApi.json()) as { url: string };
    expect(waPdfUrl).toContain('/pdf/download');

    const waPopup = await waPopupPromise;
    expect(waPopup.url()).toMatch(/whatsapp\.com|wa\.me/);
    expect(waPopup.url()).toContain('573001234567');
    const waText = new URL(waPopup.url()).searchParams.get('text') ?? '';
    expect(waText).toContain('Max E2E');
    expect(waText).toContain('Dueño E2E');
    expect(waText).toContain('/pdf/download');
    await waPopup.close();

    await page.screenshot({ path: 'e2e-screenshots/05-whatsapp-pdf.png', fullPage: true });
  });
});
