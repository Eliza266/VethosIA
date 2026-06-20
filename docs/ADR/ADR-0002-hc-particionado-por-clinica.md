# ADR-0002 — HC particionado por clínica (no shard)

- **Estado:** Aceptado
- **Fecha:** refactorización VetIA

## Contexto

Las historias clínicas necesitan un número correlativo legible (`HC000001`, `HC000002`, ...). La
implementación original usaba **un único documento global** `configuracion/contadorHC` y lo
incrementaba en una transacción por cada consulta nueva.

El problema: Firestore tiene un límite práctico de ~1 escritura/segundo sostenida **por documento**.
Con todas las clínicas y veterinarios numerando contra el mismo doc, ese contador es un cuello de
botella garantizado a medida que crece el uso (contención + reintentos + latencia).

Opciones sobre la mesa:

1. **Sharded counter** clásico: N sub-contadores y se suma al leer.
2. **Contador por clínica:** un documento de contador por organización.

## Decisión

Particionar el contador **por clínica/organización**: `configuracion/contadorHC_{orgId}` (en legacy,
`vet_{uid}`). Cada organización tiene su propio contador, incrementado en una transacción, con
formato `HC${n.padStart(6)}`. La operación vive en la API (`POST /v1/consultas/:id/hc`,
`hc.service.ts`) y es **idempotente**: si la consulta ya tiene `numeroHC`, lo devuelve sin renumerar.

No elegimos sharded counter porque:

- La numeración debe ser **correlativa y legible por humanos** (`HC000123`). Un sharded counter da
  buen throughput pero **pierde el orden correlativo** simple (sumar shards no te da una secuencia
  ordenada por clínica sin lógica extra).
- La unidad de negocio natural es la clínica: nadie comparte numeración entre organizaciones, así
  que particionar por `orgId` reparte la carga exactamente donde tiene sentido.

## Consecuencias

**Positivas:**

- Se elimina la contención global: la carga se reparte por organización. Una clínica activa no
  bloquea a las demás.
- La numeración sigue siendo correlativa y legible **dentro de cada clínica**.
- Se valida con un test de integración real (20 numeraciones concurrentes → números únicos y
  contiguos) y un escenario k6 de 10k VUs en orgs distintas.

**Negativas / límites:**

- Los números **no son globales**: dos clínicas pueden tener cada una su `HC000001`. Es lo deseado,
  pero hay que tenerlo claro al reportar/auditar entre clínicas.
- Si una sola clínica tuviera un pico extremo (>~1 numeración/segundo sostenida), su contador podría
  contender. En ese caso (poco probable por el dominio) se podría sumar sharding **dentro** de esa
  org. Hoy no hace falta.
- Sigue existiendo el contador global legacy para el camino viejo (Cloud Function) hasta retirar el
  flag.
