# Auditoria funcional V2 - brechas contra PDF

Fecha de auditoria: 2026-06-17  
Fuente funcional principal: `C:\Users\pc\Downloads\Funcionalidades x rol.pdf`  
Limitacion de extraccion: `pypdf` y `pdfplumber` no extrajeron texto util del PDF (0 caracteres en paginas revisadas). La evidencia de PDF se tomo por render local con `pypdfium2` y lectura visual de las 29 paginas.

## Criterios usados

- **Existe**: implementado, usable, conectado y razonablemente alineado con el PDF.
- **Parcial**: existe una parte, pero faltan reglas, permisos, estados, UI, backend, persistencia, tests o integracion.
- **Falta**: no hay evidencia suficiente de implementacion.
- **Dudoso**: hay indicios, pero falta ejecucion o validacion manual.
- **Requiere decision**: PDF o repo permiten mas de una interpretacion.

Prioridades: P0 bloquea seguridad/produccion/tenant/datos clinicos/pagos/flujo central; P1 necesario para Fase 1 o SaaS operable; P2 mejora importante; P3 Fase 2 o nice-to-have.

## Resumen ejecutivo

El repo ya tiene una base tecnica fuerte: API NestJS `/v1`, AuthGuard/RolesGuard globales, `assertAcceso` por `orgId`, modulos de pacientes, consultas, citas, vacunas, brigadas, SaaS, pagos Wompi, auditoria, metricas, notificaciones y tests amplios. El riesgo principal no es ausencia total de backend, sino desalineacion funcional entre un modelo actual de **organizacion plana** (`admin`, `vet`, `asistente`, `superadmin`) y el PDF, que separa **Admin Veterinaria**, **Admin Entidad**, veterinarias bajo entidad y veterinarios freelance. Tambien faltan piezas de Fase 1 que el PDF explicita: catalogo base de vacunas, evolucion longitudinal visible del paciente, cobros livianos con cartera/recibo y configuracion global parametrizable. La convivencia con `functions/` legacy sigue activa en `firebase.json` y en flags del frontend; debe gobernarse antes de ampliar roles/cobros para no duplicar contadores, email ni reglas de tenant.

## Matriz por rol y modulo

| Rol | Modulo | Funcionalidad esperada segun PDF | Evidencia PDF | Estado repo | Evidencia repo | Riesgo | Prioridad | Confianza | Recomendacion | Siguiente accion | Agente |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Transversal | Modelo de cuentas | Veterinario individual, veterinaria/hospital y entidad; entidad agrupa veterinarias y vets freelance. | p.2, p.3, p.4 A.1 | Parcial | `api/src/modules/tenant/tenant.service.ts`, `api/src/common/auth/auth-user.interface.ts`, `docs/DATA-MODEL.md` | Alto | P0 | Alto | Separar modelo `entidad`/`veterinaria`/`miembro` o definir si `organizaciones` sera polimorfica con parent. | ADR + migracion de datos + tests negativos. | Codex |
| Transversal | Roles | PDF define Veterinario, Admin Veterinaria, Admin Entidad, Super Admin y Sistema. | p.2-p.3 | Parcial | `Rol = 'superadmin'|'admin'|'vet'|'asistente'`, `frontend/src/lib/rbac.ts` | Alto | P0 | Alto | Introducir roles canonicos o mapear explicitamente `admin_veterinaria` y `admin_entidad`. | Disenar RBAC V2 y backfill claims. | Codex |
| Transversal | Paciente pertenece a cuenta | Pacientes/historias quedan en la cuenta, no en el vet individual. | p.3, p.9-p.11 | Parcial | `pacientes.service.ts` lista por `orgId` o `uid`; `access.ts` fallback legacy por `veterinarioId` | Alto | P0 | Alto | Mantener `orgId` como ownership principal y retirar fallback legacy por fases. | Inventario docs sin `orgId`; migracion y pruebas cross-tenant. | Codex |
| Transversal | Plan heredado | Vet vinculado hereda plan de veterinaria/entidad; independiente paga su plan. | p.3, p.7, p.16-p.17, p.20-p.23 | Parcial | `ConsumoService.scopeId`, `SuscripcionesService.scopeQuery`, `asientosDisponibles` | Alto | P0 | Alto | Modelar owner del plan por nivel: vet, veterinaria o entidad. | Agregar plan scope y reglas de visibilidad por rol. | Codex |
| Transversal | Frontend solo `/v1` | Prompt/repo exigen que frontend solo hable con `/v1`; PDF asume RBAC por contexto. | p.28 C.1 | Parcial | `featureFlags.ts`; `frontend/src/features/*` aun tiene Firestore legacy; `functions/index.js` | Alto | P0 | Alto | Congelar nuevas features en `/v1`; mantener legacy solo como compatibilidad documentada. | Auditoria de flags y plan para retirar Firestore directo. | Codex |
| Veterinario | Pacientes | Listado, busqueda por mascota/propietario/telefono, filtros, ficha, crear/editar/archivar, propietario completo. | p.10-p.11 B.1.1 | Parcial | `api/src/modules/pacientes/*`, `frontend/src/pages/Pacientes.tsx`, `NuevosPaciente.tsx` | Medio | P1 | Alto | Completar busqueda/filtros/paginado y campos de propietario/documento/tipo. | Slice UI + API query params + tests RTL/MSW. | Cursor |
| Veterinario | Evolucion del paciente | Mini-seccion con peso/condicion/constantes entre consultas. | p.11, p.29 Fase 1 | Parcial | `ConsultasService.propagarSignos`, `PacientesService` guarda `ultimoPeso/ultimaTalla`; `HistorialService` | Medio | P1 | Alto | Crear endpoint/modelo de evolucion longitudinal basico sin IA. | API historial/evolucion + panel en ficha. | Cursor |
| Veterinario | Consulta SOAP | Captura audio, IA procesa, borrador editable, aprobar genera historia y descuenta plan. | p.5 A.2.2, p.11-p.13 B.1.2 | Existe | `consultas.service.ts`, `ia.service.ts`, `consultas.controller.ts`, tests `consultas.service.spec.ts` | Alto | P0 | Alto | Mantener como flujo central; no mezclar aprobacion por PATCH. | Solo endurecer tests E2E y observabilidad. | Codex |
| Veterinario | Diagnostico estructurado | PDF Fase 1 pide diagnostico estructurado/dropdown estandar. | p.12, p.16 metrica #4, p.29 | Falta | SOAP guarda `analisis` texto libre; no hay catalogo diagnostico en `collections.ts` | Medio | P1 | Alto | Definir catalogo diagnostico MVP y campo normalizado. | ADR breve + DTO + UI dropdown + tests. | Codex |
| Veterinario | Recetas sugeridas IA | Medicamento, dosis, via, frecuencia, duracion, indicacion; vet decide y edita. | p.13 | Parcial | `pdf.service.ts` renderiza `medicamentosSugeridos`; `PanelMedicamentos.tsx` existe | Medio | P1 | Medio | Confirmar flujo UI de aceptar/editar/quitar antes de aprobar. | Test funcional de medicamentos en SOAP/PDF. | Cursor |
| Veterinario | PDF historia | Solo aprobadas; PDF dinamico; firma y matricula; descarga, WhatsApp, correo; auditoria por canal. | p.12-p.14 B.1.3 | Parcial | `PdfService.generar` exige aprobada y audita `pdf.exportar`; `EmailService`; `sharing.ts` | Alto | P0 | Alto | Agregar auditoria con canal especifico y previsualizacion/descarga/email/WhatsApp consistente. | Normalizar eventos `pdf.descargar`, `pdf.email`, `pdf.whatsapp`. | Codex |
| Veterinario | Historia clinica consecutiva | Numero HC consecutivo unico por institucion; no se renumera; enmienda conserva referencia. | p.12 | Existe | `hc.service.ts`, `contadorHcDocId`, `hc.concurrency.spec.ts`, `functions/index.js` legacy global | Alto | P0 | Alto | Mantener API como canonica; limitar Cloud Function legacy. | Flag/telemetria para verificar no uso de contador global. | Codex |
| Veterinario | Agenda | Dia/semana/mes, estados, paciente real, atender crea consulta, recordatorio dia anterior/proximas 2h. | p.5, p.14 B.1.4 | Parcial | `citas.service.ts`, `cita.types.ts`, `frontend/src/pages/Agenda.tsx` | Medio | P1 | Alto | Agregar recordatorios automaticos y duracion de cita. | Job/scheduler + notificaciones + tests de estado. | Codex |
| Veterinario | Vacunas | Catalogo base por especie extensible; estados al dia/proxima/vencida; resumen semanal; marcar aplicada calcula proxima. | p.11, p.15, p.27, p.29 | Parcial | `vacunas.service.ts`, `vacuna.types.ts`, `VacunasPanel.tsx` | Medio | P1 | Alto | Implementar catalogo base y extensiones por cuenta. | Modelo `catalogoVacunas` + UI selector + tests. | Codex |
| Veterinario | Mis metricas | 7 metricas: tiempo ahorrado, pacientes, SOAP mes, diagnosticos, especie, vacunacion, asistencia. | p.16 B.1.6 | Parcial | `MetricasService` cuenta pacientes/consultas/citas/vacunas; `MetricsPanel.tsx` | Medio | P1 | Alto | Ampliar metricas agregadas y periodo configurable. | Endpoints por rol + componentes. | Codex |
| Veterinario | Mi plan | Solo independiente ve plan/pago/historial/recibo; vinculado no ve modulo. | p.16-p.17 B.1.7 | Parcial | `Suscripcion.tsx`, `saas.controller.ts`, `frontend/src/lib/rbac.ts` | Alto | P1 | Alto | Ajustar visibilidad segun independencia/vinculo y corregir checkout frontend. | Fix contrato `crearCheckout(planId,ciclo)` y gates. | Cursor |
| Veterinario | Notificaciones | Campana, contador, listado, marcar leida, navegar al recurso; citas, vacunas, consumo, suscripcion/pago. | p.17 B.1.8 | Parcial | `NotificacionesService`, `NotificationBell.tsx`, `notificaciones/api.ts` | Medio | P1 | Alto | Completar tipos automáticos y `resourceRef` navegable. | Extender payload y generadores. | Cursor |
| Veterinario | Mi perfil | Nombre, email no editable, telefono, foto, firma/matricula, contrasena, pertenencia. | p.17 B.1.9 | Parcial | `MeController`, `TenantService`, `Perfil.tsx` aun usa Firestore directo | Medio | P1 | Alto | Migrar `Perfil.tsx` totalmente a `/v1/me` y agregar firma/logo si aplica. | Slice frontend y tests. | Cursor |
| Veterinario | Dashboard | Widgets agregados: consumo, vacunas, tiempo IA, citas hoy, ultimas SOAP. | p.18 B.1.10 | Parcial | `Dashboard.tsx`, `MetricsPanel`, `useCitas` | Bajo | P2 | Medio | Completar widgets faltantes y alertas proximas 2h. | UI + MSW/Vitest. | Cursor |
| Admin Veterinaria | Rol y alcance | Gestiona una clinica/hospital y sus veterinarios; puede ser independiente o pertenecer a entidad. | p.18-p.21 B.2 | Falta | No hay rol `admin_veterinaria`; `admin` se etiqueta como Admin Entidad en `rbac.ts` | Alto | P0 | Alto | Crear rol o subrol y modelo de veterinaria bajo entidad. | Diseno RBAC/migracion. | Codex |
| Admin Veterinaria | Mis veterinarios | Invitar/vincular, asientos, activar/desactivar, consumo SOAP por vet. | p.19 B.2.1 | Parcial | `InvitacionesService`, `TenantController`, `AdminEntidad.tsx` | Alto | P1 | Alto | Reutilizar invitaciones pero con scope veterinaria. | Agregar `veterinariaId` y reglas. | Codex |
| Admin Veterinaria | Mi veterinaria | Datos clinica, logo para PDFs, NIT para recibo; NIT cambia via superadmin. | p.20 B.2.2 | Parcial | `organizaciones` tiene nombre/plan/ciudad; `PdfService` lee `organizaciones`; no NIT/logo completo | Medio | P1 | Alto | Extender perfil de veterinaria y permisos de NIT/logo. | DTO + UI + tests. | Cursor |
| Admin Veterinaria | Metricas veterinaria | Caseload, productividad, tiempo IA, epidemiologia local, vacunacion, dormidos, no-show. | p.20 B.2.3 | Parcial | `MetricasService` conteos simples por entidad | Medio | P1 | Alto | Crear agregados por veterinaria y por vet. | Endpoint metricas V2 + UI. | Codex |
| Admin Veterinaria | Plan y suscripcion | Solo si veterinaria independiente; pagos Wompi, recibo, asientos, consumo. | p.20-p.21 B.2.4 | Parcial | `SuscripcionesService`, `WompiService`, `Suscripcion.tsx` | Alto | P1 | Alto | Resolver scope de plan veterinaria vs entidad antes de UI. | Modelado + correccion checkout. | Codex |
| Admin Veterinaria | Dashboard/notificaciones/perfil | Widgets de clinica, notificaciones consolidadas, perfil. | p.21 B.2.5-B.2.7 | Parcial | `AdminEntidad.tsx` cubre miembros/metricas, no rol clinica | Medio | P2 | Medio | Crear dashboard de Admin Veterinaria separado del de entidad. | UI despues de RBAC V2. | Cursor |
| Admin Entidad | Mis veterinarias | Registrar sedes nuevas o vincular existentes; activar/desactivar; consumo por sede. | p.21-p.22 B.3.1 | Falta | No existe coleccion/modelo `veterinarias` separado; `organizaciones` plana | Alto | P0 | Alto | Modelar sedes/veterinarias como entidad hija. | ADR + migracion + reglas. | Codex |
| Admin Entidad | Vets freelance | Invitar/vincular directo a entidad; heredan plan maestro. | p.22 B.3.2 | Parcial | `InvitacionesService` invita a org plana; no distingue freelance vs sede | Alto | P1 | Alto | Agregar tipo de vinculo `freelance`/`sede`. | DTO + reglas + UI. | Codex |
| Admin Entidad | Mi entidad | Nombre, NIT, direccion, ciudad, pais, logo, contacto; NIT via superadmin. | p.22 B.3.3 | Parcial | `organizaciones` tiene nombre/ciudad; `TenantService` no NIT/pais/logo/contacto | Medio | P1 | Alto | Extender entidad y validaciones. | Slice entidad perfil. | Cursor |
| Admin Entidad | Plan maestro | Cubre veterinarias + freelancers, asientos globales, consumo por sede/vet, pagos, recibo. | p.22-p.23 B.3.4 | Parcial | `scopeId=user.orgId`, `asientosDisponibles`; no sedes ni recibos | Alto | P0 | Alto | Definir plan master y consumo jerarquico antes de cobros. | Diseno dominio SaaS V2. | Codex |
| Admin Entidad | Metricas entidad | Comparativo entre sedes, cobertura territorial, vigilancia epidemiologica, brigadas, censo. | p.23 B.3.5 | Parcial | `MetricasService` conteos global/entidad simples | Medio | P1 | Alto | Crear metricas por sede/zona y fuentes de datos. | Roadmap metricas V2. | Codex |
| Admin Entidad | Brigadas | Gestionar jornadas/campanas, estado, registrar atenciones. | p.23 B.3.6 | Parcial | `brigadas.service.ts`, `Brigadas.tsx`; sin atenciones/consolidado real | Medio | P1 | Alto | Vincular consultas/atenciones a brigada y metricas. | Extender BrigadaDoc y consultas. | Codex |
| Admin Entidad | Dashboard/notificaciones/perfil | Vista consolidada, consumo, cobros, suspension, perfil. | p.23-p.24 B.3.7-B.3.9 | Parcial | `AdminEntidad.tsx`, `NotificacionesService`, `MeController` | Medio | P2 | Medio | Completar despues del modelo entidad-veterinaria. | UI de consolidado. | Cursor |
| Super Admin | Entidades | Crear/editar/activar/desactivar/listar; ver detalle, plan, pagos; desactivar bloquea vets. | p.24-p.25 B.4.1 | Parcial | `SuperAdmin.tsx` crea planes/lista pagos; no CRUD entidades global | Alto | P1 | Alto | Crear backoffice entidades con RBAC superadmin real. | Endpoints + UI + tests. | Codex |
| Super Admin | Veterinarias | Gestionar clinicas globalmente, independientes y de entidades. | p.24-p.25 B.4.2 | Falta | No hay modulo/coleccion veterinarias | Alto | P0 | Alto | Depende de modelo jerarquico. | Implementar tras ADR RBAC. | Codex |
| Super Admin | Veterinarios | Crear/editar/activar/desactivar, reset contrasena, extender trial, ver plan/consumo. | p.24-p.25 B.4.3 | Parcial | `TenantService.setBloqueoMiembro`, `SuscripcionesController.extenderTrial`; no reset/manual create UI | Alto | P1 | Medio | Endpoints operativos auditados para superadmin. | Backoffice usuarios. | Codex |
| Super Admin | Area tecnica vinculos | Evaluar solicitudes por correo ya existente, resolver conflicto de plan, vincular vets/veterinarias. | p.24-p.25 B.4.4 | Falta | `InvitacionesService` rechaza o acepta token, no cola de solicitudes tecnicas | Alto | P1 | Alto | Crear modelo `solicitudesVinculo` y flujo de decision. | Dominio + UI. | Codex |
| Super Admin | Planes y precios | Planes 3 tipos, parametrizables, activar/desactivar, limites, trial. | p.24-p.25 B.4.5 | Parcial | `PlanesService`, `PlanDoc.tipo` individual/entidad/ambos; `SuperAdmin.tsx` crea plan incompleto | Medio | P1 | Alto | Completar UI de edicion/activacion y tipo veterinaria. | UI + API tests. | Cursor |
| Super Admin | Cobros/suscripciones | Cartera por antiguedad, recibos, conciliacion Wompi, estados, MRR, dunning F2. | p.24, p.26 B.4.6, p.29 | Parcial | `WompiService`, `pagos`, `suscripciones`; no recibos/cartera | Alto | P1 | Alto | Implementar cobros livianos Fase 1: cartera + recibo, dejar MRR/dunning/DIAN F2. | Dominio cobros + pruebas Wompi. | Codex |
| Super Admin | Metricas globales | Cuentas activas, SOAP, ingresos, trial/bloqueadas, tiempo ahorrado, graficas. | p.24, p.26 B.4.7 | Parcial | `MetricasService` conteos basicos; `SuperAdmin.tsx` usa `MetricsPanel` | Medio | P2 | Alto | Agregados globales reales con periodos. | Endpoint V2 + UI. | Codex |
| Super Admin | Logs auditoria | Solo lectura, retencion 12 meses, filtros usuario/accion/fecha, detalle antes/despues. | p.24, p.26-p.27 B.4.8 | Parcial | `AuditoriaService` append-only con retencion; `AuditoriaController` sin filtros; no UI | Alto | P1 | Alto | Agregar filtros, detalle y UI; ampliar eventos. | API filtros + pagina. | Cursor |
| Super Admin | Configuracion global | Trial, audio, sesion, mora, aviso, umbral 80%, catalogo base vacunas. | p.24, p.27 B.4.9 | Falta | `env.schema.ts`/env variables; no CRUD config global seguro | Alto | P1 | Alto | Crear configuracion versionada server-side. | Diseno config + tests fail-closed. | Codex |
| Sistema | Consumo/plan | Avisar 80%, bloquear IA al 100%, reiniciar dia 1. | p.7-p.8 A.3, p.27 B.5 | Parcial | `ConsumoService` periodo mensual y notifica en aprobacion; no job dia 1 necesario por docId | Medio | P1 | Alto | Documentar reinicio por periodo y validar alertas una vez. | Tests de borde mensual y duplicados. | Codex |
| Sistema | Suscripciones | Por vencer, vencida, bloqueada por mora, fin trial, reactivar por pago. | p.6, p.8, p.27 | Parcial | `suscripcion.state.ts`, `WompiService.activarPorReferencia`; no scheduler de vencimiento/mora | Alto | P1 | Alto | Agregar jobs programados para transiciones temporales. | Scheduler/Cloud Tasks + tests. | Codex |
| Sistema | Recordatorios | Cita dia anterior, proximas 2h, resumen vacunas lunes. | p.8, p.14-p.15, p.27 | Falta | `NotificacionesService` existe; no scheduler/cron en `api` ni `functions` para estos | Medio | P1 | Alto | Implementar job idempotente de recordatorios. | Worker/scheduler + auditoria. | Codex |
| Sistema | Pagos | Conciliar webhooks Wompi, activar, recibo, rechazos, estados. | p.8, p.26-p.27 | Parcial | `WompiService` firma/idempotencia/aprobado; no recibo ni conciliacion completa | Alto | P1 | Alto | Crear recibos y estados de cartera. | Dominio cobros Fase 1. | Codex |
| Sistema | Seguridad | Sesion por inactividad 8h configurable, RBAC por contexto. | p.27-p.28 C.1 | Parcial | `useInactivityLogout`, `RolesGuard`, `firestore.rules`; no config global | Alto | P0 | Alto | Parametrizar inactividad y cerrar legacy. | Config + tests de auth. | Codex |
| Sistema | Auditoria | Cada evento critico registrado; login/logout, CRUD, SOAP, PDF, suscripcion, bloqueos. | p.7-p.8, p.26-p.27 | Parcial | `AuditoriaService.AccionAuditada`; falta login/logout, cita, vacuna, pago/recibo detallado | Alto | P1 | Alto | Completar catalogo y emitir desde todos los flujos. | Matriz evento->audit + tests. | Codex |
| Sistema | Functions legacy | Evaluar riesgo de convivencia Cloud Run/NestJS y Functions legacy. | p.4 A.1, p.7-p.8 disparadores | Parcial | `firebase.json` functions, `functions/index.js`; frontend usa flags legacy | Alto | P0 | Alto | Mantener funciones congeladas y documentar ownership de cada flujo. | Kill-switch/observabilidad por flag. | Codex |

## Top 10 brechas funcionales

1. Modelo jerarquico entidad -> veterinaria -> veterinario/freelance no existe; el repo usa organizacion plana.
2. Roles Admin Veterinaria y Admin Entidad no estan separados en claims/RBAC.
3. Cobros livianos de Fase 1 no estan completos: cartera por antiguedad y recibo faltan.
4. Catalogo base de vacunas por especie, extensible por cuenta, falta.
5. Configuracion global parametrizable del superadmin falta.
6. Jobs automaticos de Sistema para vencimiento/mora, recordatorios de cita/vacunas y resumen lunes faltan.
7. Area tecnica de vinculos por correo ya existente y conflicto de plan falta.
8. Metricas por rol son basicas; faltan productividad, epidemiologia, vacunacion, no-show, ingresos y tiempo ahorrado.
9. Auditoria no cubre todos los eventos/canales requeridos, especialmente login/logout, WhatsApp, recibos, vacunas/citas.
10. Frontend aun conserva caminos Firestore/Functions legacy, contrario al objetivo de solo `/v1` para funcionalidades nuevas.

## Top 10 modulos existentes pero incompletos

1. `tenant`: organizaciones/miembros existen, pero sin jerarquia entidad-veterinaria.
2. `saas`: planes/suscripciones/consumo existen, pero sin plan master por entidad/sede ni recibos.
3. `pagos`: Wompi existe, pero sin cartera, recibos y conciliacion visible completa.
4. `plataforma/auditoria`: append-only existe, pero sin filtros/UI ni todos los eventos.
5. `plataforma/metricas`: conteos basicos existen, pero no metricas de negocio del PDF.
6. `plataforma/notificaciones`: in-app existe, pero sin `resourceRef` ni schedulers.
7. `vacunas`: CRUD/estado existe, pero sin catalogo base/extensible ni proxima dosis sugerida.
8. `citas`: estados y vinculo consulta existen, pero sin duracion/recordatorios automaticos.
9. `frontend/Suscripcion`: pantalla existe, pero el contrato checkout no coincide con backend.
10. `functions/legacy`: sigue vivo para HC/email; requiere gobernanza para evitar doble fuente.

## Top 10 riesgos de romper produccion

1. Cambiar roles/claims sin migracion puede dejar usuarios sin acceso o con acceso cruzado.
2. Introducir veterinarias bajo entidad sin backfill de `orgId`/ownership puede exponer datos clinicos.
3. Tocar consumo/suscripcion sin idempotencia puede cobrar o descontar doble.
4. Mantener Cloud Function `generarNumeroHC` junto al contador por `orgId` puede duplicar numeracion.
5. Implementar pagos/recibos sin validar firma Wompi server-side puede activar cuentas indebidamente.
6. Hacer PDF/WhatsApp desde cliente con URLs no auditadas puede filtrar historias clinicas.
7. Retirar fallback legacy de Firestore sin inventario puede romper datos antiguos.
8. Agregar schedulers sin idempotencia puede duplicar recordatorios, bloqueos o notificaciones.
9. Configuracion global editable sin audit trail puede cambiar limites/trials/mora sin trazabilidad.
10. Completar Admin Entidad sobre el modelo plano actual puede mezclar sedes, vets freelance y clinicas independientes.

## Respuestas directas del prompt

| Pregunta | Soporte actual | Nota |
|---|---|---|
| Admin Entidad | Parcial | `admin` se etiqueta como Admin Entidad, pero sin jerarquia de veterinarias. |
| Admin Veterinaria | Falta | No hay rol/scope separado. |
| Veterinario independiente | Parcial | Fallback `vet_{uid}` y suscripcion por `veterinarioId`; falta UX/gates completos. |
| Veterinario vinculado | Parcial | Miembro `vet` en org; no distingue veterinaria vs entidad/freelance. |
| Super Admin | Parcial | Rol existe; UI/backoffice incompleto. |
| Plan heredado | Parcial | `orgId` centraliza consumo/asientos, sin niveles entidad/veterinaria. |
| Consumo por cadena | Parcial | Scope por `orgId`, no por cadena de sedes. |
| Bloqueo por mora | Parcial | Estado existe; falta scheduler/lectura-only integral. |
| Auditoria por evento | Parcial | Servicio existe; catalogo incompleto. |
| Metricas por rol | Parcial | Conteos basicos. |
| Notificaciones por nivel | Parcial | Admins entidad y destinatario; falta jerarquia completa. |
| HC consecutiva por institucion | Existe | API por `contadorHC_{tenant}`; riesgo legacy global. |
| Enmiendas de consulta aprobada | Existe | `POST /v1/consultas/:id/enmienda`. |
| PDF solo aprobadas | Existe | `PdfService` bloquea borradores. |
| WhatsApp/email con auditoria | Parcial | Email/PDF auditados; WhatsApp no como canal auditado server-side. |
| Vacunas catalogo base/extensible | Falta | Solo CRUD de vacunas aplicadas. |
| Agenda estados correctos | Parcial | Estados correctos; faltan recordatorios/duracion. |
| Brigadas por entidad | Parcial | `orgId` y estados, sin atenciones/consolidado real. |
| Cobros livianos Fase 1 | Parcial | Wompi base; faltan cartera/recibo. |
| Wompi base pagos | Existe parcial | Firma/idempotencia/activar; UI checkout desalineada. |
| Convivencia Cloud Run/Functions | Riesgosa | Activa por flags y `firebase.json`; requiere ownership por flujo. |
