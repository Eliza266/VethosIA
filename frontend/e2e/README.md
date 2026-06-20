# Tests E2E (Playwright)

Los e2e viven acá (fuera de `src/`) y los corre Playwright, no Vitest.

## Cómo correrlos

```bash
# 1) Instalar los navegadores (una sola vez). Necesita espacio en disco y red.
npm run e2e:install

# 2) Infra local (emuladores Firebase + API :8081 + seed tenant)
#    cd ../api
#    # El projectId del seed debe coincidir con VITE_FIREBASE_PROJECT_ID de Playwright (.firebaserc).
#    $env:GCLOUD_PROJECT='vethosia-production'; $env:FIREBASE_PROJECT_ID='vethosia-production'; npm run seed:e2e-local

# 3) Correr e2e (levanta Vite en :5174 con VITE_USE_API_CRUD=true y demás flags)
npm run e2e
```

Playwright inyecta al `webServer` los flags tenant (`VITE_USE_API_CRUD`, emuladores,
API IA/HC/DOCS). Usa puerto **5174** para no chocar con `npm run dev` en 5173.

## Specs

- `smoke.spec.ts`: **ejecutable sin backend**. Verifica login UI (no requiere emuladores).
- `ia-mock-local.spec.ts`: flujo tenant completo R117 (login seed → paciente API → consulta API
  → IA mock → SOAP → aprobar → PDF/email/WhatsApp). Requiere emuladores + API + seed.
- `roles-principales.spec.ts`: cobertura R118 de navbar, guards y acciones críticas por rol
  (mock de `/v1/me` + datos de consulta). Requiere emuladores + API + seed.

## Notas del entorno

En este entorno de desarrollo los navegadores de Playwright pueden no poder
instalarse (espacio en disco / red restringida). La config y los specs quedan listos
para que el CI (otro agente) los invoque con `npm run e2e` una vez que `e2e:install`
funcione.
