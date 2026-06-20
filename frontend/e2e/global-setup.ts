const API_BASE = process.env.E2E_API_BASE ?? 'http://127.0.0.1:8081';
const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
const E2E_EMAIL = process.env.E2E_EMAIL ?? 'vet@vetia.local';
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? 'VetIA-Local-2026!';

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 5_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function setupError(message: string): Error {
  return new Error(
    [
      message,
      'Requisitos locales para e2e:',
      '- Firebase emulators: auth 9099, firestore 8080, storage 9199.',
      '- API local en 127.0.0.1:8081 con FIRESTORE_EMULATOR_HOST y FIREBASE_AUTH_EMULATOR_HOST.',
      '- Seed local: cd api && npm run seed:e2e-local.',
    ].join('\n'),
  );
}

export default async function globalSetup(): Promise<void> {
  let health: Response;
  try {
    health = await fetchWithTimeout(`${API_BASE}/v1/health`);
  } catch {
    throw setupError(`API local no disponible en ${API_BASE}/v1/health.`);
  }
  if (!health.ok) {
    throw setupError(`API local respondio ${health.status} en ${API_BASE}/v1/health.`);
  }

  const signInUrl = `http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`;
  let authResponse: Response;
  try {
    authResponse = await fetchWithTimeout(signInUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: E2E_EMAIL,
        password: E2E_PASSWORD,
        returnSecureToken: true,
      }),
    });
  } catch {
    throw setupError(`Auth emulator no disponible en ${AUTH_EMULATOR}.`);
  }
  if (!authResponse.ok) {
    throw setupError(`Usuario E2E no puede iniciar sesion en Auth emulator (${authResponse.status}).`);
  }
}
