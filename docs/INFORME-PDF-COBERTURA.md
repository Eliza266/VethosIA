# Informe de cobertura PDF (Fase 1) — qué hay y qué no

Cobertura punto por punto del documento de alcances (secciones 01–09) frente a la
implementación. Evidencia = archivo y/o test. Estado: ✅ implementado, ⚠️ parcial, ❌ no.

## Prueba funcional real (tokens)
Ejecutado `api/scripts/probe-ia.ts` con llamadas reales:
- **Gemini (LLM): ✅ OK.**
- **OpenAI (STT): ✅ OK** (auth válida, transcribe).
- **Anthropic/Claude: ⚠️ clave válida pero cuenta SIN SALDO** (`credit balance too low`). El
  pipeline SOAP funciona igual porque cae al **fallback Gemini**. Para usar Claude: cargar crédito
  y `LLM_PROVIDER=anthropic`.
- API arranca y `GET /v1/health` → 200 (evidencia: boot log + smoke).

## 01. Objetivo, alcance y principios
- ✅ Digitalización clínica, voz→SOAP, pacientes/agenda/vacunas/métricas, base escalable.
- ✅ Principios: consumo por suscripción/límites, IA con aprobación del vet, seguridad/trazabilidad.
- ✅ Exclusiones Fase 2 respetadas: sin WhatsApp/SMS automático (solo botón `wa.me` manual), sin
  portal del propietario, sin telemedicina/inventario/lab/predictiva, sin migración entre modalidades.
- Nota: 01.B lista Notificaciones/Auth/Dashboards como "futuro"; el PDF las detalla en 02/03/07,
  así que se implementaron (ver ADR-0005).

## 02. Roles, actores y contexto
- ✅ Super Admin / Admin Entidad / Veterinario + RBAC jerárquico (`roles.guard.ts`, `access.ts`, `rbac.ts`).
- ✅ Aislamiento por tenant (org A no ve org B): `access.spec.ts`, `firestore.rules.spec.ts`.
- ✅ Pacientes pertenecen a la entidad (orgId); si el vet sale, permanecen (orgId no se borra).
- ✅ Estados operativos: trial/activo/por_vencer/bloqueado_mora/**bloqueado_fin_trial**/**desactivado** (`suscripcion.state.ts`).

## 03. Módulos por rol
- ✅ Matriz §3.3 aplicada: `lib/rbac.ts` + `rbac.test.ts`; navegación condicionada (Navbar) + guards de ruta (`RoleRoute`).
- ✅ Dashboards: Super Admin (`/admin`), Admin Entidad (`/entidad`), Veterinario (panel + métricas).

## 04. Dominio clínico
- ✅ Pacientes CRUD + **soft delete** + ID `PAC-XXXXXX` (`pacientes.service.ts` + tests).
- ✅ Agenda Día/Semana/Mes + estados (programada/realizada/cancelada/no_asistió); cancelada permanece (`citas` + `agenda.ts`).
- ✅ Vacunas: estados Al día/Próxima/Vencida por fecha + recordatorio (`vacuna.types.ts`, `VacunasPanel`).
- ✅ Export PDF: SOAP y **historial completo**; **solo aprobadas**; **vista previa** (modal); **logo/entidad** en encabezado; **auditado** (`pdf.service.ts` + tests).

## 05. Núcleo IA / ciclo SOAP
- ✅ Flujo 9 pasos: audio (mimeType real, multi-segmento) → STT → SOAP → revisión/edición → borrador/aprobar.
- ✅ Estados historia: Procesando/Borrador/Aprobada/Error; sin huérfanas.
- ✅ Reglas: IA solo usa el audio (prompt), descuento **al aprobar**, borrador no descuenta, aprobada
  **solo lectura**, corrección = **enmienda** (`consultas.service.ts` + tests).

## 06. Planes, suscripciones, SaaS
- ✅ Planes con todos los atributos editables (CRUD, solo Super Admin).
- ✅ Máquina de estados de suscripción + **extender trial** + bloquear/desbloquear.
- ✅ Entidad (asientos compartidos, consumo central) vs Independiente (sin herencia).
- ✅ Wompi: checkout (firma integridad) + **webhook validación de firma + idempotencia + activación**.
- ✅ Consumo: reinicio mensual (día 1), **80% notifica**, **100% bloquea IA** (`consumo.service.ts`, gate en `/procesar`).

## 07. Seguridad, auth y trazabilidad
- ✅ Auth: email+password, Google OAuth, recuperación, verificación de email, **invitación enlace único 48h** (ADR-0005, `invitaciones.service.ts`).
- ✅ HTTPS (Cloud Run), sesión inactividad 8h, RBAC, CORS cerrado en prod, claves IA fuera del cliente (test guardia).
- ✅ Auditoría de eventos críticos con retención ≥12m (`auditoria.service.ts`).
- ✅ Notificaciones por destinatario (email + in-app); WhatsApp/SMS excluidos (Fase 2).

## 08. Arquitectura lógica
- ✅ Capas: frontend (PWA) → API Gateway `/v1` (NestJS) → servicios de aplicación / IA / datos.
- ✅ Flujo de datos: Audio → STT → SOAP → revisión/aprobación → PDF → métricas/auditoría.

## 09. Modelo de información, despliegue y no funcionales
- ✅ Entidades: entidad→(vets,pacientes), paciente→(consultas,vacunas,citas), consulta→historia SOAP, suscripción→plan, notificación, log auditoría.
- ✅ Multi-tenant SaaS; entornos dev/test/prod; backups (runbook); observabilidad (logs/health/métricas); config parametrizable (planes/límites por env/doc).
- ⚠️ Alta disponibilidad/escala: Cloud Run + Cloud Tasks listos (config en `docs/DEPLOY.md`); no desplegado en este entorno.

## Construido que NO está en el PDF (mantener / nota)
- `brigadas` (legacy del repo): el PDF no lo menciona. Se mantiene como legacy, no estorba.
- `GET /v1/me`, shims de re-export, `orgContext.ts`: utilidades de soporte.

## Limitaciones honestas (entorno de esta sesión)
- **Emuladores Firebase no corren aquí** (falta Java/JDK): los tests de reglas e integración con
  emulador se ejecutan en CI/local con JDK; aquí se cubrió con unit tests (Firestore mockeado) +
  prueba real de proveedores IA + smoke de la API.
- **Claude sin saldo** en la cuenta provista (la clave es válida): SOAP usa Gemini por fallback.
- **Playwright**: smoke (arranque + auth UI) verde; los flujos clínicos completos requieren el stack
  (API + Auth/Firestore) levantado.

## Definición de HECHO
- Tests: **133 API (Jest) + 102 frontend (Vitest) = 235 verdes**; typecheck y build verdes en ambos.
- Prueba funcional con tokens ejecutada y reportada.
- Cobertura PDF 01–09: implementada (con las 3 limitaciones de entorno arriba).
