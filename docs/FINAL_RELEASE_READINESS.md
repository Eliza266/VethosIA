# Final Release Readiness - P1.8 predeploy checkpoint

Fecha local: 2026-06-19

## Alcance

Checkpoint local predeploy para revision externa del estado P0-P1.8. No se ejecuto produccion, deploy, push, stage, migraciones, cambios de `.env`, cambios de secrets, cambios de credenciales, cambios de usuarios reales ni cambios de claims productivos.

Este documento reemplaza la lectura de readiness anterior de despliegue historico. El estado actual es predeploy local: listo para preparar P1.9 deploy/smoke controlado, no desplegado en este paso.

## Fases cerradas localmente

- P0 criticos: limites de consumo/metrica, rutas seguras, fallback consulta manual y self-disable protegidos.
- P1.1 Admin Veterinaria: perfil, veterinarios, consumo, scope clinico y navegacion.
- P1.2 Admin Entidad: perfil, sedes, veterinarios/freelance cuando aplica, invitaciones V2, consumo consolidado y RBAC.
- P1.3 Super Admin + fix: gestion global de entidades y sedes con entidad destino explicita, sin crear usuarios/claims/suscripciones automaticas.
- P1.4 Brigadas basicas/operativas: creacion/listado/asignacion/atenciones/consolidado basico con aislamiento tenant.
- P1.5 Sistema/jobs/notificaciones: jobs mock/local, notificaciones internas, auditoria, idempotencia y WorkerGuard.
- P1.6 Clinico final: agenda, vacunas, pacientes, consultas, SOAP audio/manual, aprobacion, historia clinica, PDF, email mock y WhatsApp link/mock.
- P1.7 QA final/regresion: matriz por rol/modulo/tenant documentada en `docs/qa/P1_7_FINAL_REGRESSION.md`.
- P1.7-HARNESS/P1.7-FIX: rules/integration reejecutados con emuladores; fix minimo de serializacion de Brigadas documentado en `docs/qa/P1_7_HARNESS_RESULT.md`.
- P1.8: documentacion final, validacion local completa y ZIP limpio predeploy.

## Validacion local final P1.8

Variables de emulador usadas para backend rules/integration:

```text
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
GCLOUD_PROJECT=vethosia-production
FIREBASE_PROJECT_ID=vethosia-production
```

Resultados:

| Comando | Resultado |
|---|---|
| `Push-Location api; npm run build` | OK. `tsc -p tsconfig.build.json`. |
| `Push-Location api; npm run test:unit -- --runInBand` | OK. `Test Suites: 42 passed, 42 total`; `Tests: 449 passed, 449 total`; `Snapshots: 0 total`; `Time: 8.845 s`. |
| `Push-Location api; npm run test:rules` | OK. `Test Suites: 2 passed, 2 total`; `Tests: 38 passed, 38 total`; `Snapshots: 0 total`; `Time: 4.076 s`. |
| `Push-Location api; npm run test:integration` | OK. `Test Suites: 1 skipped, 4 passed, 4 of 5 total`; `Tests: 1 skipped, 27 passed, 28 total`; `Snapshots: 0 total`; `Time: 10.79 s`. |
| `Push-Location frontend; npm run typecheck` | OK. `tsc -b`. |
| `Push-Location frontend; npm run build` | OK. `verify-prod-build OK`; Firebase project `vethosia-production`; API `https://vetia-api-cwepwj6irq-uc.a.run.app`. Warning no bloqueante: chunk mayor a 500 kB. |
| `Push-Location frontend; npm run test:run` | OK. `Test Files 68 passed (68)`; `Tests 310 passed (310)`; `Duration 15.92s`. |
| `Push-Location frontend; npm run e2e -- --workers=1` | OK. `1 skipped`; `9 passed (17.5s)`. |

Skipped esperados:

- `api/test/integration/ia.live.spec.ts`: suite live protegida, no debe ejecutarse en P1.8 local sin tokens reales ni produccion.
- `frontend/e2e/flujo-principal.spec.ts`: `test.fixme` legacy; flujo clinico critico cubierto por `ia-mock-local.spec.ts`.

Ruido esperado:

- Warnings `PERMISSION_DENIED` en rules: forman parte de asserts negativos.
- Warning frontend de chunk mayor a 500 kB: P2.
- Warnings `NO_COLOR`/`FORCE_COLOR` en Playwright: entorno/harness.

## Documentacion QA

- `docs/qa/P1_7_FINAL_REGRESSION.md`: matriz final por rol, modulo y aislamiento tenant. Incluye referencia al resultado harness/fix final.
- `docs/qa/P1_7_HARNESS_RESULT.md`: evidencia de reejecucion rules/integration con emuladores y fix minimo de Brigadas.
- `docs/qa/matriz.md`: matriz QA base del repo.

## Estado funcional por rol

- `veterinario`: puede operar pacientes, consultas audio/manual, SOAP, aprobacion, historia clinica, PDF, email mock, WhatsApp link/mock, agenda, vacunas y brigadas dentro de scope.
- `admin_veterinaria`: puede gestionar su veterinaria/sede, veterinarios, invitaciones, consumo, pacientes/historias de su sede y brigadas de su scope.
- `admin_entidad`: puede gestionar entidad, sedes, veterinarios por sede, freelancers cuando el modelo lo soporta, invitaciones V2 seguras, consumo consolidado y brigadas de entidad.
- `superadmin`: puede gestionar entidades/sedes/usuarios/planes/pagos/auditoria globales, sin operar como tenant clinico.
- `sistema`: actor interno server-side para jobs/notificaciones/auditoria; no es rol humano asignable.

## No habilitado en P1.8

- Email real.
- WhatsApp API real.
- Scheduler productivo.
- Jobs contra datos reales.
- Deploy.
- Migraciones reales.
- Cambios de secrets, credenciales, usuarios reales o claims productivos.
- Upload binario completo de logos si no existe soporte seguro.
- Produccion o smoke con usuarios reales.

## Pendientes P2 separados

- Mapas/cobertura territorial avanzada.
- Analitica avanzada.
- Email real con proveedor productivo y monitoreo.
- WhatsApp API real con proveedor productivo y opt-in.
- Scheduler productivo con monitoreo/alertas.
- Code splitting para reducir warning de chunk grande.
- Uploads binarios de logo si sigue pendiente.
- Dunning/DIAN/otros procesos no core.
- E2E profundos adicionales para flujos administrativos completos y agenda manual extendida.

Estos puntos no se clasifican como bloqueantes P1 para el checkpoint local.

## Riesgos restantes antes de P1.9

- Ejecutar P1.9 solo con preview/revision controlada y smoke, no directo a usuarios reales.
- Confirmar variables reales de deploy sin escribir `.env` reales ni imprimir secretos.
- Configurar variables publicas `VITE_*` desde CI, Hosting o la shell de build aprobada; el build local conserva solo un fallback publico de API permitido y no versiona archivos `.env.*` con valores reales ni ejemplos productivos.
- Para Hosting preview contra una revision tagged de Cloud Run, usar `VETIA_BUILD_TARGET=preview`; ese modo solo permite hosts tagged del servicio `vetia-api` (`https://<tag>---vetia-api-cwepwj6irq-uc.a.run.app`). No usar ese flag para Hosting live: el build live sigue limitado a `https://vetia-api-cwepwj6irq-uc.a.run.app`.
- Validar que el bundle frontend apunta a la API prevista antes de publicar Hosting.
- Mantener email/WhatsApp reales deshabilitados hasta configuracion explicita.
- No ejecutar scheduler productivo ni jobs sobre datos reales sin plan operativo.
- Revisar que los usuarios de smoke tengan claims/scope V2 correctos antes de probar, sin mutarlos salvo aprobacion explicita.
- Mantener `tmp/`, `AUDITORIA_LOCAL/`, `rc-patches-*`, zips antiguos, logs y caches fuera de commits y ZIPs.
- El arbol de trabajo sigue sucio con cambios acumulados P0-P1.8; antes de release formal se debe revisar diff y decidir staging archivo por archivo. No usar `git add .`.

## Instrucciones locales de test

Backend:

```powershell
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
$env:FIREBASE_STORAGE_EMULATOR_HOST="127.0.0.1:9199"
$env:GCLOUD_PROJECT="vethosia-production"
$env:FIREBASE_PROJECT_ID="vethosia-production"

Push-Location api
npm run build
npm run test:unit -- --runInBand
npm run test:rules
npm run test:integration
Pop-Location
```

Frontend:

```powershell
Push-Location frontend
npm run typecheck
npm run build
npm run test:run
npm run e2e -- --workers=1
Pop-Location
```

## P1.9 recomendado

P1.9 debe ser deploy/smoke final controlado:

- No cambiar funcionalidad.
- Crear revision/preview primero.
- Verificar build frontend contra API esperada.
- Smoke por roles canonicos.
- Confirmar `/v1/health`, `/v1/me`, rutas principales, PDF, email mock y WhatsApp link/mock.
- No activar email real, WhatsApp real, scheduler productivo ni jobs reales sin aprobacion separada.
