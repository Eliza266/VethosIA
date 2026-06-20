# Preproduction Closing Plan

Fecha local: 2026-06-20

## Alcance

Plan local de cierre previo a preproduccion para VetIA/Vethosia. Este documento no
representa un deploy, promocion de trafico, activacion de integraciones reales ni
cambio de usuarios, claims, secrets o datos productivos.

## Estado Git base

- Rama actual: `codex/p18-release-prep-clean`
- Commit HEAD auditado: `58ae439 test(e2e): realign platform quality gate`
- Fuente P1.9 documentada en produccion: `ecc666e chore(release): allow tagged API verification for preview builds`
- Release record P1.9: `561e3ec docs(release): record P1.9 production rollout`
- Estado de falso dirty EOL/stat: resuelto localmente con limpieza no destructiva del
  working tree despues de confirmar que `git diff` no tenia cambios textuales.

## Lectura de commits relevantes

`ecc666e` representa el cierre tecnico usado para permitir builds preview contra
API tagged sin debilitar el gate live.

`561e3ec` documenta el rollout P1.9 en produccion: API `vetia-api-00047-vay`,
Hosting live, smoke por roles y cleanup de cuentas smoke.

Los commits posteriores son avance local post P1.9 y no deben asumirse desplegados:

- `f72d1b1 feat(frontend): add clinical command center visual foundation`
- `17b8ed2 feat(frontend): centralize role capabilities and navigation`
- `7b04ea4 feat(frontend): add role-specific command centers`
- `93cb786 feat(superadmin): add platform operations console`
- `58ae439 test(e2e): realign platform quality gate`

## Fuente autorizada recomendada

Para culminar producto desde el estado actual, la fuente autorizada local debe ser:

`58ae439 test(e2e): realign platform quality gate`

Motivo:

- Incluye el release P1.9 documentado en el historial local.
- Incluye la base visual Command Center posterior a P1.9.
- Incluye la consola Superadmin profunda.
- Incluye el realineamiento E2E posterior a esos cambios.

Importante: `58ae439` aun no debe tratarse como produccion live hasta crear una
revision/API tagged y Hosting preview controlados, ejecutar smoke y aprobar
promocion por separado.

## Estado real del producto

El producto esta en estado MVP robusto con modulos avanzados, pero todavia no es
producto final serio. Las areas con mayor riesgo antes de produccion final son:

- Trazabilidad exacta entre commit local y despliegue real.
- QA visual en una URL estable de preproduccion.
- UX/responsive premium.
- Integraciones reales de pago, email, WhatsApp e IA.
- Scheduler/jobs productivos.
- Legacy `orgId`/fallbacks y rutas/roles historicos.
- Observabilidad operativa.

## No activado

Queda explicitamente fuera de este cierre:

- Wompi real.
- Email real.
- WhatsApp API real.
- Scheduler/jobs reales contra datos productivos.
- Migraciones.
- Cambios de secrets.
- Cambios de claims.
- Cambios de usuarios reales.
- Promocion de trafico Cloud Run.
- Firebase Hosting live.
- DNS/dominio propio.

## Plan recomendado de preproduccion

### Opcion preferida: proyecto staging/preprod dedicado

Usar un proyecto Firebase/GCP separado si existe o si se puede provisionar con
aprobacion humana. Esta opcion evita mezclar QA visual/agente con datos
productivos.

Servicios:

- Cloud Run API staging.
- Firebase Hosting preview/staging.
- Firebase Auth/Firestore/Storage staging.
- Secrets staging con nombres equivalentes, sin imprimir valores.

Variables publicas necesarias:

- URL API staging o tagged.
- Firebase public config del proyecto staging.
- Flags publicos `VITE_*` compatibles con modo mock/seguro.

Integraciones reales:

- Wompi real: off.
- Email real: off.
- WhatsApp API real: off.
- Scheduler/jobs reales: off.

### Opcion controlada si no existe staging

Usar `vethosia-production` solo como infraestructura de revision, sin tocar live:

- Construir imagen API desde `58ae439`.
- Desplegar Cloud Run con `--no-traffic` y tag de revision.
- Construir frontend con `VETIA_BUILD_TARGET=preview` apuntando solo a la API tagged.
- Publicar Firebase Hosting preview channel, no live.
- Usar solo cuentas demo/smoke y fixtures marcados como demo/smoke.
- No ejecutar jobs, pagos, email real ni WhatsApp API.

Esta opcion no es una preproduccion pura porque comparte proyecto productivo, por
lo que debe tratarse como smoke controlado, no como ambiente estable de QA amplio.

## Validacion esperada de preproduccion

- `GET /v1/health` contra API tagged: 200.
- `/v1/me` sin auth: 401/403 controlado.
- Jobs sin secreto: fail closed.
- Hosting preview carga bundle correcto.
- Bundle preview contiene API tagged aprobada.
- Bundle preview no contiene localhost, API vieja ni fake keys.
- Smoke por roles con cuentas demo/smoke.
- No escrituras clinicas reales.
- No pagos reales.
- No email real.
- No WhatsApp API real.

## Apagado y rollback conceptual

Si se usa Hosting preview:

- Expirar o borrar el preview channel.
- No tocar Hosting live.

Si se usa Cloud Run tagged sin trafico:

- Mantener la revision sin trafico para evidencia o eliminarla tras aprobacion.
- No ejecutar `update-traffic`.

Si se promociona en una fase posterior:

- Rollback API: volver trafico a la revision previa aprobada.
- Rollback Hosting: clonar canal/snapshot anterior a live.

## Riesgos conocidos

- El historial local no esta respaldado en remoto.
- `vethosia.com` queda fuera de alcance; la ruta estable debe ser `web.app` o preview.
- Si se usa el proyecto productivo como pseudo-preprod, existe riesgo de tocar datos
  reales por error.
- Las cuentas demo/smoke deben estar claramente marcadas y limpiarse despues.
- Scheduler productivo existe en documentacion P1.9; no debe ejecutarse desde QA.
- El frontend tiene warning historico de chunks grandes.

## Gate para avanzar

Antes de Fase 5:

1. Worktree limpio.
2. `58ae439` o un commit posterior aprobado como fuente unica.
3. Validacion local completa verde.
4. Preview/preprod aprobado sin tocar produccion live.
5. Reporte de smoke por roles contra URL estable.

