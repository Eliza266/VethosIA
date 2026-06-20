# Matriz regla de negocio → test (Vethos AI MVP)

Cada regla del alcance (PDF §3 / plan maestro) tiene al menos un test. Una épica no es "done"
hasta que su(s) fila(s) estén verdes. `OK` = test implementado y verde. `TODO` = pendiente.

| # | Regla de negocio | Épica | Test(s) | Estado |
|---|---|---|---|---|
| R0 | Config de entorno inválida → la API no arranca (fail-fast) | E0 | `api/test/unit/env.schema.spec.ts` | OK |
| R1 | Sin Bearer → 401; rol insuficiente → 403; ruta pública OK | E1 | `api/test/unit/guards.spec.ts` | OK |
| R2 | Email no permitido o lectura whitelist falla → signOut; mensaje visible en Login | E1 | `frontend features/auth + Login` | OK (parcial) |
| R3 | 401/403 de la API dispara logout/redirect en el cliente | E1 | `frontend apiClient.authError.test.ts` | OK |
| R4 | Aislamiento por tenant: org A no accede a recursos de org B (API) | E2/E14 | `api/test/unit/access.spec.ts` | OK |
| R5 | Numeración HC monotónica por clínica, sin colisión bajo concurrencia | E2 | `api/test/unit/hc.concurrency.spec.ts` | OK |
| R6 | `configuracion` no escribible desde el cliente | E2 | `api/test/rules/firestore.rules.spec.ts` | OK |
| R7 | Paciente eliminado (soft delete) no aparece en listados ni es exportable, pero persiste | E3 | `api/test/unit/pacientes.service.spec.ts` | OK |
| R8 | ID legible de paciente `PAC-XXXXXX` por entidad | E3 | `pacientes.service.spec.ts` | OK |
| R9 | Cita: transición de estado inválida rechazada; cancelada permanece en historial | E4 | `citas.service.spec.ts` | OK |
| R10 | Vacuna: estado por fecha (al día / próxima a vencer / vencida) en las fronteras | E5 | `vacunas.service.spec.ts` | OK |
| R11 | STT: si el proveedor primario falla, cae al fallback; mimeType correcto | E6 | `stt.service.spec.ts` | OK |
| R12 | SOAP: JSON inválido → saneado/reintento; no inventa datos fuera del audio | E6 | `soap.service.spec.ts` | OK |
| R13 | Worker `/v1/ia/procesar` sin secreto → 401 (fail-closed) | E6/E14 | `worker.guard.spec.ts` | OK |
| R14 | Pipeline IA: si falla, consulta queda en `error` (sin huérfanas en `procesando`) | E6 | `ia.service.spec.ts` | OK (base) |
| R15 | Aprobar descuenta exactamente 1 del consumo; borrador no descuenta; aprobada inmutable | E6/E7 | `consultas.service.spec.ts` | OK |
| R16 | Enmienda de aprobada crea documento enlazado (no sobrescribe) | E6 | `consultas.service.spec.ts` | OK |
| R17 | `generarNumeroHC` no traga errores (propaga error manejable) | E6 | `hc.service.spec.ts` + frontend api | OK |
| R18 | PDF: solo historias aprobadas son exportables; export deja log de auditoría | E8 | `pdf.service.spec.ts` | OK |
| R19 | PDF aislado por tenant `historiales/{orgId}/...` + signed URL; cross-tenant denegado | E8/E14 | `pdf.service.spec.ts` + rules | OK |
| R20 | Consumo: reinicia el día 1; 80% notifica (una vez); 100% bloquea IA | E7 | `consumo.service.spec.ts` | OK |
| R21 | Suscripción: máquina de estados (trial→activa→por_vencer→vencida/bloqueada) válida | E7 | `suscripcion.state.spec.ts` | OK |
| R22 | Entidad hereda asientos/consumo central; independiente no hereda; asientos no exceden plan | E7 | `consumo.service.spec.ts` | OK |
| R23 | Wompi: webhook con firma inválida rechazado; idempotente; pago confirmado activa | E7 | `wompi.service.spec.ts` | OK |
| R24 | `crearOrganizacion` no pisa claims de usuario con org previa | E7/E14 | `tenant.service.spec.ts` | OK |
| R25 | Email rate-limit global (no por instancia) | E9 | `email.service` (Firestore store) | OK (impl) |
| R26 | Cada notificación se emite al destinatario correcto | E9 | `plataforma.service.spec.ts` | OK |
| R27 | Cada acción crítica deja log de auditoría `{actor,orgId,recurso,timestamp}` | E10 | `plataforma.service.spec.ts` | OK |
| R28 | Métricas respetan visibilidad por rol (global/entidad/individual) | E10 | `plataforma.service.spec.ts` | OK |
| R29 | Visibilidad de módulos por rol (matriz §3.3) en navegación y guards | E11 | `frontend rbac.test.ts` | OK |
| R61 | UI: asistente no ve acciones de eliminar (vacunas, consulta borrador); admin/vet sí | E11 | `VacunasPanel.test.tsx` + `ConsultaActions.test.tsx` + `rbac.test.ts` | OK |
| R62 | Firestore: DELETE vacunas/citas alineado con pacientes/consultas (admin/vet sí; asistente NO; cross-tenant NO) | E14 | `firestore.rules.spec.ts` | OK |
| R30 | PWA instalable + offline shell + background sync de audio | E12 | `vite-plugin-pwa` build + SW | OK (parcial) |
| R31 | Cero claves de IA en el bundle del cliente | E6/E14 | `frontend noClientAiKeys.test.ts` | OK |
| R32 | IA bloqueada al 100% de consumo antes de generar | F2.1 | `consultas.service.spec.ts (prepararProcesamiento)` | OK |
| R33 | Auditoría de eventos críticos (paciente, SOAP, aprobar, enmienda, plan/suscripción, bloqueos) | F2.2-2.4 | `pacientes/consultas/plataforma specs` | OK |
| R34 | Notificación al cruzar 80% / 100% de consumo (al vet y admins) | F2.5 | `consultas.service.spec.ts` | OK |
| R35 | Pago Wompi confirmado activa suscripción y notifica | F2.6 | `wompi.service.spec.ts` | OK |
| R36 | Estados suscripción incluyen bloqueado_fin_trial y desactivado | F2.9 | `suscripcion.state.spec.ts` | OK |
| R37 | Extender trial mueve trialHasta y reactiva trial | F2.10 | `suscripciones.service.spec.ts` | OK |
| R38 | Export PDF de historial completo (solo aprobadas) + logo entidad | F2.11/2.12 | `pdf.service.spec.ts` | OK |
| R39 | Invitación 48h: válida activa, expirada/firma inválida rechazada, respeta asientos | F2.13 | `invitaciones.service.spec.ts` | OK |
| R40 | Auth email+password + Google + recuperación + verificación | F3.14 | `Login.tsx` + Playwright `smoke.spec.ts` | OK |
| R41 | Agenda Día/Semana/Mes via /v1; citas vinculadas a paciente + consulta (`Atender` → `citaId`) | F3.9 | `citas/agenda.test.ts` + `citas.service.spec.ts` + `citas/api.test.ts` | OK (prod deploy 2026-06-16) |
| R42 | Contratos /v1 (SOAP/metricas/consumo/paciente) validados | F4.1 | `shared/contracts.test.ts` | OK |
| R43 | Background-sync de audio offline (cola + reintento) | F3.18 | `lib/offlineAudioQueue.test.ts` | OK |
| R44 | Prueba funcional REAL con tokens (Gemini+OpenAI OK; Claude fallback) | F1 | `scripts/probe-ia.ts` (ejecutado) | OK |
| R45 | Flujo local IA mock (emuladores): login → paciente → consulta → transcribir/SOAP → aprobar → PDF | E6/E8 | `frontend/e2e/ia-mock-local.spec.ts` + `api/scripts/e2e-runtime-smoke.ts` | OK |
| R46 | PDF server-side local (`VITE_USE_API_DOCS=true`, Storage emulator + signed URL dev) | E8 | `e2e/ia-mock-local.spec.ts` (POST `/pdf`) + `e2e-runtime-smoke.ts` | OK |
| R47 | Email mock local (`EMAIL_MOCK=true`, sin SendGrid/SMTP) | E9 | `email.service.spec.ts` + `e2e-runtime-smoke.ts` + Playwright email | OK |
| R48 | WhatsApp local + PDF server-side (`VITE_USE_API_DOCS`, wa.me con `/pdf/download`) | E10 | `sharing.test.ts` + Playwright WhatsApp | OK |
| R49 | Consultas CRUD multi-tenant (`VITE_USE_API_CRUD=true`, POST/GET/PATCH `/v1/consultas`, POST `/aprobar`, orgId) | E6/E8 | `consultas.integration.spec.ts` + Playwright `ia-mock-local.spec.ts` | OK |
| R50 | PATCH consultas no puede aprobar (`estado: aprobada` → 400; aprobación solo `/aprobar`; aprobadas inmutables) | E6/E8 | `consultas.service.spec.ts` + `consultas.integration.spec.ts` | OK |
| R51 | DELETE consultas multi-tenant (`DELETE /v1/consultas/:id`, hard delete borrador, aprobada bloqueada, cross-tenant 403) | E6/E8 | `consultas.service.spec.ts` + `consultas.integration.spec.ts` (12/12 con emuladores) + `data.test.ts` | OK |
| R52 | Dashboard/Pacientes citas sin Firestore directo (`listarCitas` /v1, filtro cliente) | E4/E11 | `frontend test:run` + Playwright tenant | OK |
| R53 | Perfil/vet context tenant (`GET/PATCH /v1/me`, Perfil/DetalleConsulta/auth sin FS vet con `CRUD=true`) | E6/E8 | `me.integration.spec.ts` + `tenant/api.test.ts` + `auth/hooks.test.tsx` + Playwright | OK |
| R54 | Brigadas tenant (`GET/POST/PATCH /v1/brigadas`, orgId server-side, cross-tenant 403) | E6/E8 | `brigadas.service.spec.ts` + `brigadas.integration.spec.ts` + `brigadas/api.test.ts` | OK |
| R55 | Whitelist acceso tenant (`GET /v1/me` valida `configuracion/acceso` server-side; auth sin FS con `CRUD=true`) | E6/E8 | `acceso.service.spec.ts` + `me.integration.spec.ts` + `auth/hooks.test.tsx` | OK |
| R56 | Fotos de pacientes Storage org-scoped (`fotos-pacientes/{orgId}/{pacienteId}/**`, cross-tenant denegado) | E3/E14 | `patientPhotoStorage.test.ts` + `storage.rules.spec.ts` | OK |
| R57 | Foto de paciente persiste vía PATCH `/v1/pacientes/:id` (`foto` en DTO + respuesta GET) | E3 | `pacientes.service.spec.ts` | OK |
| R58 | DELETE vacuna solo admin/vet; asistente → 403; cross-tenant vía PacientesService | E5 | `guards.spec.ts` + `vacunas.service.spec.ts` | OK |
| R59 | Branding visible **Vethos AI** (navbar, login, PWA, PDF server-side footers) | E11/E8 | build frontend + `pdf.service.spec.ts` | OK |
| R60 | PDF oficial server-side en prod; jsPDF cliente alineado branding (no preview contradictorio en UI) | E8 | `DetalleConsulta` download proxy + handoff | OK |
| R79 | `admin_entidad` de entidad A no puede leer ni escribir documentos de entidad B. | RBAC V2 | `access-v2.spec.ts` | OK (unit) |
| R80 | `admin_veterinaria` de una sede no puede leer documentos de una sede hermana. | RBAC V2 | `access-v2.spec.ts` | OK (unit) |
| R81 | `admin_veterinaria` no puede operar el plan si `planOwnerId` pertenece a la entidad. | SaaS V2 | `access-v2.spec.ts` | OK (unit) |
| R82 | Veterinario freelance de entidad no puede ver pacientes de una veterinaria sin asignacion explicita. | RBAC V2 | `access-v2.spec.ts` | OK (unit) |
| R83 | Veterinario de veterinaria no puede ver pacientes freelance directos de la entidad sin asignacion explicita. | RBAC V2 | `access-v2.spec.ts` | OK (unit) |
| R84 | Un paciente sigue perteneciendo a `accountId` aunque cambie o se retire el `veterinarioId`. | Modelo V2 | `access-v2.spec.ts` | OK (unit) |
| R85 | Documento clinico nuevo sin `accountId` o con scope inconsistente se rechaza. | Modelo V2 | `access-v2.spec.ts` | OK (unit) |
| R86 | Consumo de vet independiente incrementa `consumos/{vet_uid}_{periodo}`. | SaaS V2 | `consumo-v2.spec.ts` | OK (unit) |
| R87 | Consumo de veterinaria independiente incrementa `consumos/{veterinariaId}_{periodo}`. | SaaS V2 | `consumo-v2.spec.ts` | OK (unit) |
| R88 | Consumo de veterinaria bajo entidad incrementa `consumos/{entidadId}_{periodo}` y conserva dimension `veterinariaId`. | SaaS V2 | `consumo-v2.spec.ts` | OK (unit) |
| R89 | Claims V2 sin mapping de `admin` legacy no conceden permisos V2. | Auth V2 | `access-v2.spec.ts` | OK (unit) |
| R90 | Cambio de membresia revoca/actualiza claims y exige refresh de token. | Auth V2 | `claims-v2.spec.ts` | OK (unit) |
| R91 | Invitacion manipulada por cliente no puede cambiar `role`, `accountId`, `entidadId`, `veterinariaId` ni `planOwnerId`. | Tenant V2 | `invitaciones.service.spec.ts` | OK (unit) |
| R92 | Storage niega lectura/escritura de historiales o fotos por path de otra cuenta. | Storage V2 | `storage.rules.spec.ts` | OK (rules) |
| R93 | Contador HC V2 se particiona por `accountId`; callable legacy no genera numeros V2. | Legacy/V2 | `hc-v2.spec.ts` | OK (unit/characterization) |
| R94 | Backfill V2 es idempotente: segunda corrida no duplica consumo ni cambia mappings revisados. | Migracion V2 | `backfill-v2.spec.ts` | OK (unit) |
| R95 | Rollback de claims restaura `orgId`/`rol` sin borrar campos V2. | Rollback V2 | `claims-v2.spec.ts` | OK (unit) |
| R96 | `superadmin` solo accede por rutas auditadas de soporte, no por accidente en endpoints tenant normales. | Auth V2 | `access-v2.spec.ts` | OK (unit) |
| R97 | Navegacion y dashboard interno muestran modulos por rol V2 sin datos reales obligatorios. | UI RBAC V2 | `rbac.test.ts` + `Navbar.test.tsx` + `Dashboard.test.tsx` | OK (unit) |
| R98 | Guards frontend separan `admin_entidad`/`admin_veterinaria`, evitan `superadmin` en rutas tenant normales y conservan compatibilidad `admin`/`vet` legacy. | UI RBAC V2 | `RoleRoute.test.tsx` + `rbac.test.ts` | OK (unit) |
| R99 | Asistente no ve acciones criticas de consulta/plan/gestion administrativa en navegacion o dashboard. | UI RBAC V2 | `Dashboard.test.tsx` + `Navbar.test.tsx` + `rbac.test.ts` | OK (unit) |
| R100 | Diagnostico estructurado visible y compatible con texto libre existente. | Clinica F1 | `diagnosticos.test.ts` + `DiagnosticoEstructuradoPanel.test.tsx` + `SoapViewerDiagnosis.test.tsx` | OK (unit) |
| R101 | Evolucion del paciente muestra constantes reales sin inventar datos. | Clinica F1 | `evolucion.test.ts` + `EvolucionClinicaPanel.test.tsx` | OK (unit) |
| R102 | Catalogo base de vacunas por especie visible, solo lectura y testeado. | Clinica F1 | `catalogo.test.ts` + `VacunasPanel.test.tsx` | OK (unit) |
| R103 | Suscripcion/plan visible y checkout cliente envia solo `planId`/`ciclo` sin monto ni referencia. | Negocio F1 | `saas/api.test.ts` + `Suscripcion.test.tsx` + `BusinessOverview.test.tsx` | OK (unit) |
| R104 | Consumo visible por rol sin activar runtime V2: entidad, veterinaria y veterinario muestran scopes separados. | Negocio F1 | `business.test.ts` + `BusinessOverview.test.tsx` + `Dashboard.test.tsx` | OK (unit) |
| R105 | Cobros livianos visuales muestran pagos recientes o estado vacio sin DIAN, dunning ni webhooks nuevos. | Negocio F1 | `BillingSummary.test.tsx` + `Suscripcion.test.tsx` | OK (unit) |
| R106 | Runtime resuelve contexto V2 con fallback legacy `orgId`/`rol`. | Runtime V2 | `access.spec.ts` | OK (unit) |
| R107 | Nuevos documentos clinicos escriben scope V2 server-side. | Runtime V2 | `pacientes.service.spec.ts` + `consultas.service.spec.ts` | OK (unit) |
| R108 | Lecturas prefieren V2 y conservan fallback `orgId`. | Runtime V2 | `access.spec.ts` | OK (unit) |
| R109 | Backfill dry-run reporta cobertura sin escribir ni mutar datos reales. | Runtime V2 | `backfill-v2.spec.ts` | OK (unit) |
| R110 | Aislamiento runtime V2 evita accesos cruzados entre entidad/sede y bloquea superadmin en rutas tenant normales. | Runtime V2 | `access.spec.ts` + `consultas.service.spec.ts` | OK (unit) |
| R111 | Indices Firestore cubren queries Runtime V2 sin retirar indices legacy. | Runtime V2 | `firestore-indexes.spec.ts` | OK (unit) |
| R112 | Pago aprobado genera recibo Fase 1 idempotente; pago duplicado no duplica recibo y firma invalida no genera recibo. | Cobros F1 | `wompi.service.spec.ts` | OK (unit) |
| R113 | Cartera clasifica antiguedad como `al_dia`, `pendiente`, `vencido_1_30`, `vencido_31_60`, `vencido_60_mas` o `bloqueado`, sin DIAN ni dunning automatico. | Cobros F1 | `suscripciones.service.spec.ts` | OK (unit) |
| R114 | UI muestra cartera/recibos reales de `/v1/pagos/me` o empty state seguro, sin datos falsos. | Cobros F1 | `saas/api.test.ts` + `BillingSummary.test.tsx` + `Suscripcion.test.tsx` | OK (unit) |
| R115 | Jobs internos de suscripcion, trial, citas y vacunas son idempotentes por evento/recurso/periodo. | Jobs F1 | `plataforma.service.spec.ts` | OK (unit) |
| R116 | Auditoria registra pagos aprobados/rechazados, recibos generados, bloqueos y jobs de sistema. | Auditoria V2 | `wompi.service.spec.ts` + `plataforma.service.spec.ts` | OK (unit) |
| R117 | E2E cubre flujo clinico critico con entorno local autenticado/emuladores. | E2E | `frontend/e2e/ia-mock-local.spec.ts` | OK (e2e) |
| R118 | E2E cubre roles principales y acciones criticas. | E2E | `frontend/e2e/roles-principales.spec.ts` | OK (e2e) |
| R119 | Wompi se configura por planOwner con roles correctos; secretos persistidos en GCP Secret Manager y Firestore solo guarda nombres de recurso. | Pagos tenant | `tenant-secrets.service.ts` + `pagos-config.service.spec.ts` + `wompi.service.spec.ts` + `Suscripcion.test.tsx` | OK (unit) |
| R120 | Deploy no bloquea por Wompi global; checkout queda deshabilitado hasta configuracion de cuenta. | Pagos tenant | `pagos-config.service.spec.ts` + `env.schema.ts` + `Suscripcion.test.tsx` | OK (unit) |
| R121 | Roles humanos canonicos coinciden con el PDF: `superadmin`, `admin_entidad`, `admin_veterinaria`, `veterinario`. | RBAC V2 | `access-v2.spec.ts` + `claims-v2.spec.ts` + `rbac.test.ts` | OK (unit) |
| R122 | `sistema` solo opera como actor interno de jobs/auditoria y no como usuario Auth ni rol asignable. | RBAC V2 | `access-v2.spec.ts` + `claims-v2.spec.ts` + `plataforma.service.spec.ts` | OK (unit) |
| R123 | `asistente` queda legacy/deprecated: no es RolV2, no puede invitarse/crearse y no recibe permisos V2 nuevos. | RBAC V2 | `access-v2.spec.ts` + `invitaciones.service.spec.ts` + `tenant.service.spec.ts` + `rbac.test.ts` + `Navbar.test.tsx` + `Dashboard.test.tsx` | OK (unit) |
| R124 | `admin_veterinaria` tiene scope V2 real: `/v1/me` no degrada a Admin Entidad, invita veterinarios a su sede, no ve sedes hermanas y suscripcion heredada queda solo lectura. | RBAC V2 | `me.controller.spec.ts` + `tenant.service.spec.ts` + `invitaciones.service.spec.ts` + `suscripciones.service.spec.ts` + `Navbar.test.tsx` + `RoleRoute.test.tsx` + `AdminVeterinaria.test.tsx` + `Suscripcion.test.tsx` | OK (unit) |

## E2E obligatorios (Playwright)
1. Onboarding → invitar vet → claims correctos.
2. Login (Google) + acceso denegado muestra mensaje.
3. Ciclo clínico: paciente → consulta → audio → procesar → revisar/editar SOAP → aprobar → PDF → compartir. **(parcial OK local con IA mock: `ia-mock-local.spec.ts`)**
4. Consumo 80% → 100% (bloquea) → reinicio.
5. Wompi: checkout → webhook confirmado → activación; firma inválida rechazada; idempotente.
6. Agenda: realizada/cancelada/no asistió; cancelada persiste.
7. Vacunas: estados por fecha.
8. PDF: borrador no exportable; aprobada exportable; export auditada.
