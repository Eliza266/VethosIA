# ADR-0001 — Strangler Fig sobre Firebase + API NestJS

- **Estado:** Aceptado
- **Fecha:** refactorización VetIA

## Contexto

VetIA nació como una app Firebase "todo desde el navegador": React habla directo con Firestore,
usa Cloud Functions para un par de cosas (numerar HC, mandar email) y llama a Gemini **con la API
key expuesta en el cliente**. Funciona, pero arrastra problemas que escalan mal:

- Lógica sensible (numeración, IA, PDF, email) vive en el cliente o repartida en Functions sueltas.
- El secreto de Gemini está en el navegador.
- No hay un contrato versionado ni un lugar central para autorización server-side.
- Reescribir todo de cero sería largo y riesgoso para una app que ya está en uso.

Necesitábamos modernizar **sin** un corte big-bang ni romper a los usuarios actuales.

## Decisión

Aplicar el patrón **Strangler Fig**: montar una **API NestJS** (sobre **Cloud Run**) como nueva
fachada que va absorbiendo responsabilidades del sistema viejo, una a la vez. El frontend decide,
por **feature flag**, si una operación usa el camino viejo (Firestore directo / Cloud Functions /
Gemini cliente) o el camino nuevo (la API). **Todos los flags arrancan apagados.**

- API con contrato `/v1`, auth por `Authorization: Bearer <Firebase ID token>`, guards globales
  fail-closed (`AuthGuard` + `RolesGuard`).
- NestJS por ser modular, tipado fuerte y fácil de testear; Cloud Run por escalar a cero y ser barato.
- Las Cloud Functions originales quedan intactas en su contrato durante la transición.

## Consecuencias

**Positivas:**

- Migración incremental y reversible: prendés un flag, observás, y si algo falla lo apagás (sin
  redeploy del backend).
- La lógica sensible y los secretos salen del navegador.
- Un único lugar para autorización, validación y contrato.
- Bajo riesgo: con flags apagados, el comportamiento es idéntico al actual.

**Negativas / costos:**

- Durante la transición hay **dos caminos** para varias operaciones (más superficie que mantener y
  testear). Mitigado con tests de caracterización que fijan el comportamiento legacy.
- Hay duplicación temporal (p. ej. numeración de HC en Functions y en la API) hasta completar la
  migración.
- Sumamos un servicio nuevo a operar (Cloud Run, Cloud Tasks).

**Cuándo retirar el andamio:** cuando todos los flags estén encendidos en prod y estables, se pueden
retirar los caminos legacy (Cloud Functions duplicadas, llamadas a Gemini desde el cliente).
