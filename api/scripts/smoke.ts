/* eslint-disable no-console */
// Smoke test post-deploy: verifica que la API responde en /v1/health.
// Uso: SMOKE_BASE_URL=https://<run-url> ts-node scripts/smoke.ts
import axios from 'axios';

async function main(): Promise<void> {
  const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
  const url = `${base.replace(/\/$/, '')}/v1/health`;
  console.log(`[smoke] GET ${url}`);
  const res = await axios.get(url, { timeout: 10_000 });
  if (res.status !== 200) {
    throw new Error(`Health no OK: status ${res.status}`);
  }
  console.log('[smoke] OK', res.data);
}

main().catch((err) => {
  console.error('[smoke] FALLO:', (err as Error).message);
  process.exit(1);
});
