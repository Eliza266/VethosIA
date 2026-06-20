# Documentación de VetIA

Bienvenido. Acá está toda la documentación de la arquitectura y de la refactorización de VetIA.
Si sos dev nuevo, leé en este orden:

1. **[PASO-A-PASO](./PASO-A-PASO.md)** — el documento estrella: qué se hizo en la refactorización,
   fase por fase, con antes/después, checklist y estado de tests. **Empezá acá.**
2. **[ARQUITECTURA](./ARQUITECTURA.md)** — cómo encaja todo: componentes, flujo de request,
   Strangler Fig, multi-tenant y decisiones clave.
3. **[DATA-MODEL](./DATA-MODEL.md)** — colecciones Firestore, modelo multi-tenant, reglas e índices.
4. **[API](./API.md)** — contrato de cada endpoint `/v1`, feature flags y enrutado legacy vs API.
5. **[RUNBOOK](./RUNBOOK.md)** — cómo levantar todo, migrar, desplegar, variables/secrets y
   troubleshooting.
6. **[TESTING](./TESTING.md)** — estrategia de pruebas y la convención de comentarios estilo humano.
7. **[ADR/](./ADR/)** — decisiones de arquitectura (el porqué de lo importante).

## Índice de `/docs`

| Documento | De qué va |
|---|---|
| [PASO-A-PASO.md](./PASO-A-PASO.md) | Relato ordenado de toda la refactorización (fases 0–6) |
| [ARQUITECTURA.md](./ARQUITECTURA.md) | Arquitectura objetivo + diagramas + decisiones |
| [DATA-MODEL.md](./DATA-MODEL.md) | Firestore, multi-tenant, reglas, índices |
| [API.md](./API.md) | Endpoints `/v1`, feature flags, enrutado |
| [RUNBOOK.md](./RUNBOOK.md) | Operación: local, migración, deploy, troubleshooting |
| [DEPLOY.md](./DEPLOY.md) | Cloud Run, Hosting, smoke tests |
| [VETHOSIA_PROD.md](./VETHOSIA_PROD.md) | Proyecto prod `vethosia-production` desde cero (checklist, env, bootstrap) |
| [TESTING.md](./TESTING.md) | Pruebas (unit, reglas, integración, e2e, k6) + comentarios |
| [ADR/ADR-0001](./ADR/ADR-0001-strangler-fig-firebase-nestjs.md) | Strangler Fig + NestJS |
| [ADR/ADR-0002](./ADR/ADR-0002-hc-particionado-por-clinica.md) | HC por clínica (no shard) |
| [ADR/ADR-0003](./ADR/ADR-0003-multitenant-orgid-claims.md) | Multi-tenant por `orgId` + claims |

## Otros documentos del repo

- [`README.md`](../README.md) (raíz) — portada del proyecto.
- [`README.infra.md`](../README.infra.md) — notas de backend/infra.
- [`api/README.md`](../api/README.md) — README de la API.
- [`frontend/README.md`](../frontend/README.md) — README del frontend.
