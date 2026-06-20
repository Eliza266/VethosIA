# Roadmap de implementacion V2

Fuente funcional: `Funcionalidades x rol.pdf` paginas 1-29, especialmente fases de pagina 29.  
Restriccion: este roadmap no implementa features; ordena trabajo para Codex/GPT alto razonamiento y Cursor Composer rapido.

## Diagnostico

El repo esta listo para evolucionar, pero no para implementar masivamente todo el PDF sin una Fase 0. La base tecnica es buena: API `/v1`, guards globales, tenant por `orgId`, SaaS/consumo, Wompi, auditoria, PDF server-side, tests unitarios/integracion y frontend con rutas principales. El bloqueo esta en arquitectura funcional: el PDF exige tres niveles de cuenta (vet independiente, veterinaria, entidad) y dos admins distintos (Admin Veterinaria/Admin Entidad), mientras el repo modela una organizacion plana.

## Fase 0 - estabilizacion y base RBAC/datos

Objetivo: cerrar riesgos P0 antes de sumar UI/cobros.

| Orden | Tarea | Agente | Archivos objetivo | Riesgo | Tests |
|---|---|---|---|---|---|
| 0.1 | ADR de modelo jerarquico V2: entidad, veterinaria, vet freelance, plan owner. | Codex | `docs/ADR/*`, `docs/DATA-MODEL.md` | Alto | Revision documental + matriz casos. |
| 0.2 | Definir roles V2 y estrategia de claims/backfill. | Codex | `api/src/common/auth/*`, `firestore.rules`, docs | Alto | `access.spec.ts`, rules negativas. |
| 0.3 | Inventario legacy: docs sin `orgId`, uso de flags, uso de Functions HC/email. | Codex | scripts/docs, no app code primero | Alto | Reporte + comandos de lectura. |
| 0.4 | Corregir contrato frontend checkout vs backend antes de ampliar pagos. | Cursor | `frontend/src/features/saas/api.ts`, `Suscripcion.tsx` | Medio | `saas/api.test.ts`, typecheck. |
| 0.5 | Definir ownership de `functions/` legacy y kill-switch por flujo. | Codex | `docs/API.md`, `docs/RUNBOOK.md`, `functions/*` solo despues | Alto | Tests de flags + smoke. |
| 0.6 | Matriz evento->auditoria->notificacion->metrica. | Codex | `docs/qa/matriz.md`, docs V2 | Medio | QA rows nuevas. |

Criterios de salida:

- Decidido si se crean roles explicitos o scopes sobre `admin`.
- Definido modelo de cuenta y migracion.
- No hay nuevas features dependientes de Firestore directo.
- Checkout Wompi UI y DTO backend estan alineados.
- Riesgo de contador HC global documentado y monitoreado.

## Fase 1 - alcance aprobado del PDF

Objetivo: completar lo marcado en PDF Fase 1 sin romper produccion.

| Orden | Tarea | Agente | Dependencias | Tests |
|---|---|---|---|---|
| 1.1 | Diagnostico estructurado: catalogo/dropdown y campo normalizado en consulta. | Codex | Fase 0 RBAC | Unit dominio + API + RTL. |
| 1.2 | Firma/matricula y configuracion de encabezado PDF por cuenta. | Cursor | Modelo cuenta | `pdf.service.spec.ts`, snapshot PDF. |
| 1.3 | Evolucion del paciente: constantes longitudinales basicas. | Cursor | Consultas/pacientes actuales | `historial.service.spec.ts`, UI ficha. |
| 1.4 | Catalogo base de vacunas por especie y extension por cuenta. | Codex | Config global/scope cuenta | `vacunas.service.spec.ts`, rules. |
| 1.5 | Recordatorios internos de vacunas/citas (no propietario) con jobs idempotentes. | Codex | Notificaciones V2 | Unit scheduler + integration emulator. |
| 1.6 | Cobros livianos: cartera por antiguedad y recibo. | Codex | Wompi contrato estable | `wompi.service.spec.ts`, recibos unit. |
| 1.7 | Admin Veterinaria minimo: miembros, mi veterinaria, metricas basicas, plan si independiente. | Cursor | Roles/modelo V2 | RTL + E2E rol. |
| 1.8 | Admin Entidad minimo: veterinarias, vets freelance, plan maestro y brigadas. | Codex | Modelo jerarquico | API integration cross-tenant. |
| 1.9 | Auditoria ampliada: filtros y eventos faltantes. | Cursor | Matriz evento | Unit + UI superadmin. |
| 1.10 | Dashboard widgets por rol con datos reales. | Cursor | Metricas V2 | RTL/MSW + typecheck. |

Criterios de salida:

- Fase 1 de pagina 29 cubierta: diagnostico estructurado, firma/matricula, constantes/evolucion, catalogo vacunas, cartera+recibo.
- Admin Veterinaria y Admin Entidad no se confunden.
- Todo flujo nuevo usa `/v1`.
- `npm run build`, `npm run test:unit`, `npm run typecheck` pasan.
- `docs/qa/matriz.md` tiene filas verdes para las nuevas reglas.

## Fase 2 - mejoras posteriores

No implementar todavia salvo que Fase 1 este estable:

- Resumen longitudinal del paciente con IA.
- Recordatorios automaticos al propietario.
- Analitica MRR avanzada.
- Dunning automatico.
- Factura electronica DIAN.
- Instrucciones de alta por IA.
- WhatsApp/SMS automaticos.
- Analitica territorial avanzada con mapas.

## Dependencias entre modulos

1. RBAC/modelo cuenta desbloquea Admin Veterinaria, Admin Entidad, plan heredado y metricas.
2. Configuracion global desbloquea trial, mora, umbrales, duracion audio, catalogo vacunas e inactividad.
3. Auditoria V2 desbloquea soporte, cobros, vinculaciones y acciones superadmin.
4. Notificaciones con `resourceRef` desbloquean recordatorios y campana navegable.
5. Cobros/recibos dependen de Wompi server-side y plan owner definido.
6. Brigadas con atenciones dependen de consultas vinculadas a brigada.

## Riesgos de romper produccion

- Migrar claims sin forzar refresh de token y fallback controlado.
- Cambiar estructura de Firestore sin backfill e indices.
- Agregar jobs programados sin idempotencia.
- Permitir que el frontend calcule monto de Wompi.
- Ampliar Super Admin sin filtros/auditoria.
- Retirar legacy antes de confirmar flags productivos.

## Pruebas necesarias por fase

Fase 0:

- `api/test/unit/access.spec.ts`
- `api/test/rules/firestore.rules.spec.ts`
- `frontend/src/lib/rbac.test.ts`
- Tests de contrato checkout frontend/backend

Fase 1:

- Unit de maquinas de estado: cita, SOAP, suscripcion, invitacion, vacuna, brigada.
- Integration con Firebase emulator para cross-tenant y roles V2.
- Vitest + RTL con MSW para nuevas pantallas.
- Playwright de flujo por rol: vet, admin veterinaria, admin entidad, superadmin.
- Tests de Wompi: firma invalida, idempotencia, recibo, cartera.
- Tests de PDF render: firma/matricula/logo y solo historias aprobadas.

Fase 2:

- Pruebas de IA con mocks y provider real opcional.
- Jobs idempotentes de dunning/recordatorios propietario.
- Pruebas DIAN en sandbox cuando aplique.

## Que NO se debe implementar todavia

- MRR/dunning/DIAN antes de cartera+recibo Fase 1.
- Resumen longitudinal IA antes de evolucion basica por constantes.
- Portal del propietario antes de recordatorios internos y seguridad.
- Nuevas escrituras Firestore directas desde frontend.
- Refactor total de UI sin modelo RBAC cerrado.
- Reemplazo destructivo de `functions/` sin plan de rollback.

## Reparto recomendado

Codex/GPT alto razonamiento:

- ADR y modelo RBAC/datos.
- Migraciones y reglas tenant.
- Maquinas de estado y jobs idempotentes.
- Cobros/Wompi/recibos.
- Auditoria y seguridad.
- Metricas agregadas de dominio.

Cursor Composer rapido:

- Pantallas y componentes una vez definido contrato.
- Formularios CRUD de entidad/veterinaria/perfil.
- Ajustes de copy/UI.
- Tests RTL/MSW de pantallas.
- Correcciones de contrato frontend localizadas.

## Primera secuencia de implementacion

1. ADR RBAC jerarquico V2.
2. Fix contrato checkout frontend/backend.
3. Modelo de veterinaria/entidad y pruebas cross-tenant.
4. Catalogo base de vacunas.
5. Cobros livianos: cartera + recibo.
