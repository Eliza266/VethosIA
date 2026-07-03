# Vethos AI — Guía para agentes

Vethos AI (antes "VetIA") es un SaaS de historias clínicas veterinarias (multi-tenant, PWA). Tres
piezas: `frontend/` (React 19 + Vite, PWA), `api/` (NestJS 10, contrato `/v1`, Cloud Run) y
`functions/` (Cloud Functions legacy). Sobre Firebase (Auth, Firestore, Storage), proyecto
`vethosia-5895b`.

## Desarrollo local
Local se trabaja **contra el proyecto real `vethosia-5895b`** (ADC de `gerencia@vethosia.com`),
**no con emuladores** (esta máquina no tiene Java). Ver Quickstart en `README.md`. El job
`api-emulator` de CI sí usa el Firebase Emulator Suite (corre en GitHub Actions, con Java).

## Principios no negociables
- El frontend SOLO habla con `/v1`. Sin claves de IA en el navegador. Sin lógica de tenant en el cliente.
- Autorización en la API vía `common/auth/access.ts` (orgId primero). El Admin SDK se salta las reglas de Firestore.
- Secretos solo server-side. Ningún `VITE_*` con clave de proveedor.
- TDD en la lógica de dominio; una micro-tarea = un commit; CI siempre verde.

## Estructura
- `api/src/modules/*` — dominios (consultas, ia, tenant, pacientes, citas, vacunas, planes, suscripciones, pagos, notificaciones, metricas, auditoria, email, storage, health).
- `api/src/common/*` — config (env tipada + validación fail-fast), firebase (Admin SDK), auth (guards + access).
- `frontend/src/{lib,features,pages,components}` — capas; `features/<f>/{api,hooks}.ts`.

## Reglas detalladas
Ver `.cursor/rules/` (global, frontend, backend, security) y el plan maestro en `docs/VETIA_MASTER_PROMPT.md` si existe.

## Tests
- Backend: `cd api ; npm run test:unit` (Jest). Integración/reglas con Firebase Emulator Suite.
- Frontend: `cd frontend ; npm run test:run` (Vitest + RTL + MSW). E2E: `npm run e2e` (Playwright).
