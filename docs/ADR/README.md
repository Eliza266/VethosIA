# Architecture Decision Records (ADR)

Decisiones de arquitectura importantes, cada una con su contexto, la decisión tomada y las
consecuencias. Son cortas a propósito: explican el **porqué** para que el que venga después no tenga
que adivinar.

| ADR | Título | Estado |
|---|---|---|
| [ADR-0001](./ADR-0001-strangler-fig-firebase-nestjs.md) | Strangler Fig sobre Firebase + API NestJS | Aceptado |
| [ADR-0002](./ADR-0002-hc-particionado-por-clinica.md) | HC particionado por clínica (no shard) | Aceptado |
| [ADR-0003](./ADR-0003-multitenant-orgid-claims.md) | Multi-tenant por `orgId` + custom claims | Aceptado |

> Formato: contexto → decisión → consecuencias. Si una decisión cambia, no edites la vieja: agregá
> un ADR nuevo que la reemplace y marcá la anterior como "Reemplazado por ADR-XXXX".
