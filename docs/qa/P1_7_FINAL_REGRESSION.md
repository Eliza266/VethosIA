# P1.7 QA final / regresion completa

Fecha: 2026-06-19
Entorno: local con API/emuladores disponibles parcialmente
Alcance: QA/regresion P0-P1.6. Sin produccion, sin deploy, sin push, sin stage, sin migraciones, sin claims reales, sin email/WhatsApp real y sin jobs contra datos reales.

## Actualizacion P1.7-HARNESS / P1.7-FIX

Despues de este reporte inicial se ejecuto `P1.7-HARNESS` con emuladores locales y variables exportadas. `test:rules` paso completo (`2 suites`, `38 tests`) y `test:integration` revelo un fallo real de Brigadas al persistir `descripcion: undefined` en Firestore.

Se aplico `P1.7-FIX minimo` solo en la serializacion local del repositorio de Brigadas, sin `ignoreUndefinedProperties` global y sin cambiar comportamiento funcional. El resultado final esta documentado en `docs/qa/P1_7_HARNESS_RESULT.md`:

- `api npm run build`: OK.
- `api npm run test:unit -- --runInBand`: OK, `42 suites`, `449 tests`.
- `api npm run test:rules`: OK, `2 suites`, `38 tests`.
- `api npm run test:integration`: OK, `4 suites passed`, `1 skipped live`, `27 tests passed`, `1 skipped`.
- `frontend npm run typecheck`: OK.
- `frontend npm run test:run`: OK, `68 files`, `310 tests`.
- `frontend npm run e2e -- --workers=1`: OK, `9 passed`, `1 skipped`.

Con esta actualizacion, la decision de P1.7 queda: aprobado para P1.8. No quedan bloqueantes P0/P1 conocidos por QA local.

## 1. git status inicial

```text
 M api/src/common/firebase/collections.ts
 M api/src/modules/brigadas/brigada.types.ts
 M api/src/modules/brigadas/brigadas.controller.ts
 M api/src/modules/brigadas/brigadas.module.ts
 M api/src/modules/brigadas/brigadas.repository.ts
 M api/src/modules/brigadas/brigadas.service.ts
 M api/src/modules/brigadas/dto/brigada.dto.ts
 M api/src/modules/consultas/consultas.service.ts
 M api/src/modules/consultas/pdf.service.ts
 M api/src/modules/pacientes/historial.service.ts
 M api/src/modules/plataforma/auditoria.service.ts
 M api/src/modules/plataforma/metricas.service.ts
 M api/src/modules/plataforma/notificaciones.service.ts
 M api/src/modules/plataforma/system-config.ts
 M api/src/modules/plataforma/system-jobs.service.ts
 M api/src/modules/saas/consumo.service.ts
 M api/src/modules/saas/suscripciones.service.ts
 M api/src/modules/tenant/backoffice.controller.ts
 M api/src/modules/tenant/backoffice.service.ts
 M api/src/modules/tenant/dto/backoffice.dto.ts
 M api/src/modules/tenant/dto/invitacion.dto.ts
 M api/src/modules/tenant/invitaciones.service.ts
 M api/src/modules/tenant/tenant.service.ts
 M api/test/unit/backoffice.service.spec.ts
 M api/test/unit/brigadas.service.spec.ts
 M api/test/unit/invitaciones.service.spec.ts
 M api/test/unit/pdf.service.spec.ts
 M api/test/unit/plataforma.service.spec.ts
 M frontend/e2e/roles-principales.spec.ts
 M frontend/playwright.config.ts
 M frontend/src/App.tsx
 M frontend/src/components/AudioRecorder.tsx
 M frontend/src/components/Navbar.test.tsx
 M frontend/src/components/NotificationBell.test.tsx
 M frontend/src/components/NotificationBell.tsx
 M frontend/src/components/RoleRoute.test.tsx
 M frontend/src/components/RoleRoute.tsx
 M frontend/src/features/backoffice/api.test.ts
 M frontend/src/features/backoffice/api.ts
 M frontend/src/features/brigadas/api.test.ts
 M frontend/src/features/brigadas/api.ts
 M frontend/src/features/notificaciones/api.ts
 M frontend/src/features/notificaciones/routing.test.ts
 M frontend/src/features/notificaciones/routing.ts
 M frontend/src/features/tenant/api.test.ts
 M frontend/src/features/tenant/api.ts
 M frontend/src/lib/rbac.test.ts
 M frontend/src/lib/rbac.ts
 M frontend/src/pages/AdminEntidad.test.tsx
 M frontend/src/pages/AdminEntidad.tsx
 M frontend/src/pages/AdminVeterinaria.test.tsx
 M frontend/src/pages/AdminVeterinaria.tsx
 M frontend/src/pages/Brigadas.tsx
 M frontend/src/pages/Dashboard.test.tsx
 M frontend/src/pages/Notificaciones.test.tsx
 M frontend/src/pages/Notificaciones.tsx
 M frontend/src/pages/NuevaConsulta.tsx
 M frontend/src/pages/SuperAdmin.test.tsx
 M frontend/src/pages/SuperAdmin.tsx
 M frontend/src/types/index.ts
?? AUDITORIA_LOCAL/
?? api/src/common/auth/clinical-history-scope.ts
?? api/src/modules/saas/plan-limits.ts
?? api/test/unit/historial.service.spec.ts
?? frontend/e2e/global-setup.ts
?? frontend/src/components/BrigadasRoute.test.tsx
?? frontend/src/components/BrigadasRoute.tsx
?? frontend/src/pages/Agenda.test.tsx
?? frontend/src/pages/Brigadas.test.tsx
?? frontend/src/pages/NuevaConsulta.test.tsx
?? frontend/src/pages/RouteFallback.test.tsx
?? frontend/src/pages/RouteFallback.tsx
?? rc-patches-d1d1f9c/
?? veterinariaIa-checkpoint-p0-p15-CLEAN.zip
```

## 2. Resumen ejecutivo

- No se detectaron fallos bloqueantes de producto en las suites ejecutadas.
- Backend build y unit pasaron completos: 42 suites / 447 tests.
- Frontend typecheck, build, unit y e2e pasaron. E2E: 9 passed / 1 skipped.
- `test:rules` y `test:integration` existen, pero en esta shell quedaron totalmente skipped porque no estaban exportadas las variables de emulador requeridas (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST`, `GCLOUD_PROJECT`, `FIREBASE_PROJECT_ID`). Se clasifican como `HARNESS/ENTORNO`, no como OK.
- El build frontend mantiene el warning conocido de chunk mayor a 500 kB; no bloquea P1.7.
- Playwright mantiene ruido conocido de `auth/network-request-failed` durante un caso de roles, pero todas las specs activas pasaron.
- El PDF funcional de roles existe pero no tiene texto extraible por `pypdf` (`29 paginas`, `0 chars`); se uso junto con la transcripcion/decision local en `docs/RBAC_TENANT_MODEL_V2.md`. El QA tecnico externo si tiene texto extraible (`6 paginas`, `11834 chars`) y sus hallazgos principales quedan cubiertos por P0-P1.6 salvo brechas E2E especificas.

Decision: aprobado para avanzar a P1.8 limpieza/docs/checkpoint final, condicionado a registrar que rules/integration deben reejecutarse con variables de emulador exportadas antes de un gate de release estricto. No se requiere P1.7-FIX de producto.

## 3. Comandos ejecutados y resultado exacto

| Comando | Resultado |
|---|---|
| `Push-Location api; npm run build` | OK. `tsc -p tsconfig.build.json`. Exit code 0. |
| `Push-Location api; npm run test:unit -- --runInBand` | OK. `Test Suites: 42 passed, 42 total`; `Tests: 447 passed, 447 total`; `Snapshots: 0 total`; `Time: 14.626 s`. Exit code 0. |
| `Push-Location api; npm run test:rules` | NO EJECUTADO / BLOQUEADO POR PRECONDICION. Script existe y sale 0, pero Jest reporto `Test Suites: 2 skipped, 0 of 2 total`; `Tests: 38 skipped, 38 total`. |
| `Push-Location api; npm run test:integration` | NO EJECUTADO / BLOQUEADO POR PRECONDICION. Script existe y sale 0, pero Jest reporto `Test Suites: 5 skipped, 0 of 5 total`; `Tests: 28 skipped, 28 total`. |
| `Push-Location frontend; npm run typecheck` | OK. `tsc -b`. Exit code 0. |
| `Push-Location frontend; npm run build` | OK. `tsc -b && vite build && node scripts/verify-prod-build.mjs`. `verify-prod-build OK`. Warning no bloqueante: chunks mayores a 500 kB. Exit code 0. |
| `Push-Location frontend; npm run test:run` | OK. `Test Files 68 passed (68)`; `Tests 310 passed (310)`; `Duration 18.58s`. Exit code 0. |
| `Push-Location frontend; npm run e2e -- --workers=1` | OK con ruido de consola. `Running 10 tests using 1 worker`; `1 skipped`; `9 passed (22.6s)`. Exit code 0. |

## 4. Tests no ejecutados y causa

| Suite | Causa | Clasificacion |
|---|---|---|
| `api/test/rules/firestore.rules.spec.ts` | `describe.skip` porque `FIRESTORE_EMULATOR_HOST` no estaba definido en la shell de Jest. | HARNESS/ENTORNO |
| `api/test/rules/storage.rules.spec.ts` | `describe.skip` por precondicion de emulador/variable no disponible. | HARNESS/ENTORNO |
| `api/test/integration/*.spec.ts` | `describe.skip` porque `FIRESTORE_EMULATOR_HOST` y/o `FIREBASE_AUTH_EMULATOR_HOST` no estaban definidos. | HARNESS/ENTORNO |
| `api/test/integration/ia.live.spec.ts` | Live test protegido por flag; no debe ejecutarse en P1.7 local sin produccion ni tokens reales. | HARNESS/ENTORNO |

Variables observadas antes del reporte:

```text
FIRESTORE_EMULATOR_HOST=
FIREBASE_AUTH_EMULATOR_HOST=
FIREBASE_STORAGE_EMULATOR_HOST=
GCLOUD_PROJECT=
FIREBASE_PROJECT_ID=
```

Servicios locales verificados:

```text
API /v1/health: HTTP 200
Auth emulator: HTTP 200
Firestore emulator: HTTP 200
Storage emulator: NO DISPONIBLE en raiz HTTP (501), no tratado como produccion ni como fallo de producto.
```

## 5. E2E activos / skipped / fixme

Activos:

- `frontend/e2e/smoke.spec.ts`
  - App carga y redirige a login sin sesion.
  - Login muestra propuesta de valor.
  - Login ofrece email/password, Google y recuperacion.
- `frontend/e2e/ia-mock-local.spec.ts`
  - Login -> paciente -> consulta IA mock -> SOAP -> aprobar -> PDF -> email mock -> WhatsApp.
- `frontend/e2e/roles-principales.spec.ts`
  - Veterinario ve flujo clinico operativo.
  - Asistente legacy sin permisos criticos.
  - Admin Entidad accede a entidad y no soporte.
  - Admin Veterinaria accede a veterinaria.
  - Super Admin queda en soporte/plataforma y no entra a rutas tenant.

Skipped/fixme:

- `frontend/e2e/flujo-principal.spec.ts`
  - `test.fixme('crear paciente, consulta con audio, aprobar y generar PDF')`.
  - Equivalente moderno cubierto parcialmente por `ia-mock-local.spec.ts`, pero sigue como deuda de harness/legacy.

Brechas E2E especificas:

- Consulta manual end-to-end no existe; existe cobertura frontend unit (`NuevaConsulta.test.tsx`).
- Agenda -> atender cita -> aprobar -> cita realizada end-to-end no existe; existe cobertura unit/frontend/backend.
- Admin Veterinaria con datos reales de sede propia/ajena no esta cubierto end-to-end; hay unit/frontend y e2e de navegacion.
- Admin Entidad con flujo completo sedes/freelance/consumo/brigadas no esta cubierto end-to-end; hay unit/frontend y e2e parcial.
- Sistema/jobs no tiene E2E; esta cubierto por unit backend y WorkerGuard.

## 6. Matriz final por rol

| Rol | Rutas permitidas | Rutas prohibidas | Acciones permitidas | Acciones prohibidas | Datos permitidos/prohibidos | Cobertura | Brechas |
|---|---|---|---|---|---|---|---|
| Veterinario | `/`, `/pacientes`, `/pacientes/nuevo`, `/pacientes/:id`, `/pacientes/:id/consultas/*`, `/agenda`, `/vacunas`, `/brigadas`, `/perfil`, `/notificaciones` | `/admin`, `/entidad`, `/veterinaria`, soporte global, config global | Crear/ver pacientes, consulta audio/manual, SOAP, aprobar, PDF, email mock, WhatsApp link, citas, vacunas, participar en brigadas | Gestion global, ver otros tenants, cambiar plan heredado, auditoria global | Ve su cuenta/scope; no ve otros `accountId`, `entidadId`, `veterinariaId` | Unit backend/frontend + E2E `ia-mock-local` y roles | Falta E2E manual y agenda completa |
| Admin Veterinaria | `/veterinaria`, `/pacientes`, `/agenda`, `/vacunas`, `/brigadas`, `/suscripcion`, `/perfil`, `/notificaciones` | `/entidad`, `/admin`, superadmin/config global | Perfil clinica, miembros, invitaciones, consumo sede, pacientes/historias de sede, brigadas sede | Ver sedes hermanas, plan maestro entidad, soporte global, self-disable | Ve `veterinariaId/accountId` propio; no sedes hermanas | `AdminVeterinaria.test.tsx`, backoffice/invitaciones/consumo unit, e2e navegacion | Falta E2E con datos cross-sede reales/mock |
| Admin Entidad | `/entidad`, `/brigadas`, `/suscripcion`, `/perfil`, `/notificaciones` | `/veterinaria` como panel principal, `/admin`, rutas clinicas operativas directas | Perfil entidad, sedes, vets por sede, freelancers, invitaciones seguras, consumo consolidado, brigadas entidad | Editar historia clinica, operar clinica directa, soporte global | Ve su `entidadId`; no entidad ajena aunque comparta `orgId` | `AdminEntidad.test.tsx`, backoffice/brigadas unit, e2e navegacion/deep link | Falta E2E completo sedes/freelance/consumo |
| Super Admin | `/admin`, `/planes`, `/suscripciones`, `/auditoria`, `/configuracion`, `/metricas` con placeholders/soporte | `/pacientes`, `/agenda`, `/vacunas`, `/brigadas`, `/entidad`, `/veterinaria` como tenant | Entidades, sedes, usuarios, planes, pagos, auditoria, soporte global | Operar clinica tenant normal, escribir secretos desde UI, saltarse auditoria | Ve global por endpoints auditados; no opera clinica tenant | `SuperAdmin.test.tsx`, RoleRoute, access-v2, e2e roles | Falta E2E CRUD global profundo |
| Sistema | Sin UI/Auth humano | Todo flujo de usuario normal | Jobs internos, notificaciones, auditoria, estados suscripcion/invitaciones | Rol asignable, claims humanos, email/WhatsApp real en QA | Actor tecnico server-side; no visibilidad UI | `worker.guard.spec.ts`, `plataforma.service.spec.ts`, claims-v2 | Falta E2E/jobs runtime mock completo |

## 7. Matriz final por modulo

| Modulo | Estado QA | Cobertura | Brechas |
|---|---|---|---|
| Auth/login | OK | smoke e2e, hooks/apiClient tests | Login/whitelist parcial segun matriz historica |
| RBAC/RoleRoute | OK | `rbac.test.ts`, `RoleRoute.test.tsx`, e2e roles | Ninguna bloqueante |
| Pacientes | OK | `pacientes.service.spec.ts`, pacientes api/frontend, e2e clinico | Rules no ejecutado en esta shell |
| Consultas audio/manual | OK | backend consultas, `NuevaConsulta.test.tsx`, e2e audio mock | E2E manual faltante |
| SOAP | OK | `soap.service.spec.ts`, diagnosticos/normalize tests, e2e IA mock | Ninguna bloqueante |
| Aprobacion clinica | OK | consultas unit, aprobar roles/concurrency, e2e | Ninguna bloqueante |
| Consumo | OK | consumo unit/v2, dashboard/business tests | No hay e2e 80/100 completo |
| PDF | OK | pdf service/render/unit, e2e PDF | Rules/storage suite skipped |
| Email mock | OK | email unit, e2e email mock | No envio real por scope |
| WhatsApp link/mock | OK | sharing unit, e2e popup/link | No envio real por scope |
| Agenda/citas | OK | citas service/api/agenda unit, Agenda page unit | Falta e2e agenda completa |
| Vacunas | OK | vacunas service/api/panel/page unit | Falta e2e vacunas |
| Historia clinica | OK | historial unit y pdf historial scope | Rules/integration skipped |
| Brigadas | OK | brigadas unit/frontend/e2e ruta | Integration skipped |
| Admin Veterinaria | OK | page/api/backend/e2e ruta | Falta e2e datos cross-sede |
| Admin Entidad | OK | page/api/backend/e2e ruta | Falta e2e full flujo |
| Super Admin | OK | page/backend/e2e ruta | Falta e2e CRUD profundo |
| Suscripciones/planes/pagos | OK | saas/wompi/suscripciones unit/frontend | No Wompi real por scope |
| Sistema/jobs/notificaciones | OK unit | plataforma/worker/notificaciones unit | Falta runtime/e2e jobs mock |
| Auditoria | OK unit | plataforma/wompi/pdf tests | Falta pantalla dedicada profunda |
| Firestore/Storage rules | NO EJECUTADO en esta shell | tests existen | Bloqueado por env de emuladores no exportada |

## 8. Matriz de aislamiento tenant

| Caso | Resultado QA | Evidencia |
|---|---|---|
| `entidadId` | Cubierto por unit; no e2e profundo | `access-v2.spec.ts`, `backoffice.service.spec.ts`, AdminEntidad tests |
| `veterinariaId` | Cubierto por unit/frontend/e2e parcial | `access-v2.spec.ts`, `AdminVeterinaria.test.tsx`, roles e2e |
| `veterinarioId` | Cubierto como actor/fallback, no owner principal V2 | `access.spec.ts`, `access-v2.spec.ts`, consultas/pacientes tests |
| `accountId` | Cubierto por runtime V2 y P1.6 historial fail-closed | `clinical-history-scope.ts`, `historial.service.spec.ts`, consultas/pacientes tests |
| `planOwnerId` | Cubierto por consumo/suscripcion V2 | `consumo-v2.spec.ts`, `suscripciones.service.spec.ts`, `backoffice.service.spec.ts` |
| fallback legacy `orgId` | Cubierto por access legacy/runtime | `access.spec.ts`, firestore rules tests existen pero skipped |
| dos entidades comparten `orgId` | Cubierto por unit backend; falta e2e | `backoffice.service.spec.ts`, `access-v2.spec.ts` |
| sedes hermanas misma entidad | Cubierto por unit/backend/frontend; e2e parcial deep link | `access-v2.spec.ts`, `roles-principales.spec.ts` |
| veterinario freelance directo entidad | Cubierto por AdminEntidad/tenant tests | `AdminEntidad.test.tsx`, invitaciones/backoffice tests |
| deep links prohibidos | Cubierto por e2e roles principales | `/veterinaria` admin_entidad redirige; superadmin tenant cerrado |

## 9. Hallazgos clasificados

### BLOQUEANTE P0/P1

Ninguno detectado en suites ejecutadas.

### IMPORTANTE NO BLOQUEANTE

1. Faltan E2E dedicados para consulta manual, agenda completa y flujos administrativos profundos. Hay unit/frontend/backend coverage, pero no todos los flujos obligatorios P1.7 existen como Playwright.
2. `test:rules` y `test:integration` quedaron skipped por variables de emulador no exportadas. No indica bug de producto, pero el gate de release estricto debe reejecutarlos con env local completo.

### P2

1. Warning de build: chunk principal mayor a 500 kB.
2. Cobertura territorial/mapa, analitica avanzada, DIAN/dunning y scheduler productivo permanecen fuera de scope.

### HARNESS/ENTORNO

1. `test:rules`: 2 suites / 38 tests skipped por precondicion.
2. `test:integration`: 5 suites / 28 tests skipped por precondicion.
3. Playwright muestra ruido `FirebaseError: auth/network-request-failed` en consola durante roles; las specs pasaron. Ya constaba como ruido observable en readiness anterior.
4. `frontend/e2e/flujo-principal.spec.ts` sigue `test.fixme`, cubierto parcialmente por `ia-mock-local.spec.ts`.

## 10. Decision

Aprobado para P1.8 limpieza/docs/checkpoint final. No se requiere correccion minima P1.7-FIX de producto.

Condicion operativa: antes de cualquier gate de release/deploy real, reejecutar `npm run test:rules` y `npm run test:integration` con variables de emulador exportadas y seed local si aplica.

## 11. Siguiente prompt recomendado

Si se acepta esta decision:

```text
Ejecuta P1.8 limpieza/docs/checkpoint final. No implementes funcionalidades nuevas. No deploy, no push, no stage. Limpia/organiza solo artefactos permitidos, actualiza docs finales y prepara checkpoint limpio.
```

Si se quiere cerrar la brecha harness antes de P1.8:

```text
Ejecuta SOLO P1.7-HARNESS: reintenta backend rules/integration con emuladores locales y variables FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST, FIREBASE_STORAGE_EMULATOR_HOST, GCLOUD_PROJECT y FIREBASE_PROJECT_ID configuradas en la shell. No corrijas producto.
```

## 12. git status final

```text
 M api/src/common/firebase/collections.ts
 M api/src/modules/brigadas/brigada.types.ts
 M api/src/modules/brigadas/brigadas.controller.ts
 M api/src/modules/brigadas/brigadas.module.ts
 M api/src/modules/brigadas/brigadas.repository.ts
 M api/src/modules/brigadas/brigadas.service.ts
 M api/src/modules/brigadas/dto/brigada.dto.ts
 M api/src/modules/consultas/consultas.service.ts
 M api/src/modules/consultas/pdf.service.ts
 M api/src/modules/pacientes/historial.service.ts
 M api/src/modules/plataforma/auditoria.service.ts
 M api/src/modules/plataforma/metricas.service.ts
 M api/src/modules/plataforma/notificaciones.service.ts
 M api/src/modules/plataforma/system-config.ts
 M api/src/modules/plataforma/system-jobs.service.ts
 M api/src/modules/saas/consumo.service.ts
 M api/src/modules/saas/suscripciones.service.ts
 M api/src/modules/tenant/backoffice.controller.ts
 M api/src/modules/tenant/backoffice.service.ts
 M api/src/modules/tenant/dto/backoffice.dto.ts
 M api/src/modules/tenant/dto/invitacion.dto.ts
 M api/src/modules/tenant/invitaciones.service.ts
 M api/src/modules/tenant/tenant.service.ts
 M api/test/unit/backoffice.service.spec.ts
 M api/test/unit/brigadas.service.spec.ts
 M api/test/unit/invitaciones.service.spec.ts
 M api/test/unit/pdf.service.spec.ts
 M api/test/unit/plataforma.service.spec.ts
 M frontend/e2e/roles-principales.spec.ts
 M frontend/playwright.config.ts
 M frontend/src/App.tsx
 M frontend/src/components/AudioRecorder.tsx
 M frontend/src/components/Navbar.test.tsx
 M frontend/src/components/NotificationBell.test.tsx
 M frontend/src/components/NotificationBell.tsx
 M frontend/src/components/RoleRoute.test.tsx
 M frontend/src/components/RoleRoute.tsx
 M frontend/src/features/backoffice/api.test.ts
 M frontend/src/features/backoffice/api.ts
 M frontend/src/features/brigadas/api.test.ts
 M frontend/src/features/brigadas/api.ts
 M frontend/src/features/notificaciones/api.ts
 M frontend/src/features/notificaciones/routing.test.ts
 M frontend/src/features/notificaciones/routing.ts
 M frontend/src/features/tenant/api.test.ts
 M frontend/src/features/tenant/api.ts
 M frontend/src/lib/rbac.test.ts
 M frontend/src/lib/rbac.ts
 M frontend/src/pages/AdminEntidad.test.tsx
 M frontend/src/pages/AdminEntidad.tsx
 M frontend/src/pages/AdminVeterinaria.test.tsx
 M frontend/src/pages/AdminVeterinaria.tsx
 M frontend/src/pages/Brigadas.tsx
 M frontend/src/pages/Dashboard.test.tsx
 M frontend/src/pages/Notificaciones.test.tsx
 M frontend/src/pages/Notificaciones.tsx
 M frontend/src/pages/NuevaConsulta.tsx
 M frontend/src/pages/SuperAdmin.test.tsx
 M frontend/src/pages/SuperAdmin.tsx
 M frontend/src/types/index.ts
?? AUDITORIA_LOCAL/
?? api/src/common/auth/clinical-history-scope.ts
?? api/src/modules/saas/plan-limits.ts
?? api/test/unit/historial.service.spec.ts
?? docs/qa/P1_7_FINAL_REGRESSION.md
?? frontend/e2e/global-setup.ts
?? frontend/src/components/BrigadasRoute.test.tsx
?? frontend/src/components/BrigadasRoute.tsx
?? frontend/src/pages/Agenda.test.tsx
?? frontend/src/pages/Brigadas.test.tsx
?? frontend/src/pages/NuevaConsulta.test.tsx
?? frontend/src/pages/RouteFallback.test.tsx
?? frontend/src/pages/RouteFallback.tsx
?? rc-patches-d1d1f9c/
?? veterinariaIa-checkpoint-p0-p15-CLEAN.zip
```
