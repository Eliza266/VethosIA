# ADR-0003 — Multi-tenant por `orgId` + custom claims

- **Estado:** Aceptado
- **Fecha:** refactorización VetIA

## Contexto

VetIA no tenía concepto de "clínica/organización". Todo colgaba de `veterinarioId`, lo que impedía
compartir pacientes entre colegas de la misma clínica y separar datos por organización de forma
limpia. Para crecer (varias clínicas, varios usuarios por clínica, roles) hacía falta multi-tenancy.

Restricciones:

- No podíamos romper los datos existentes (que solo tienen `veterinarioId`).
- El aislamiento tiene que aplicarse en **dos lados**: el acceso directo del cliente a Firestore
  (reglas) y la API nueva (server-side).
- Queríamos evitar un lookup extra a Firestore en cada request solo para saber a qué tenant
  pertenece el usuario.

## Decisión

Modelo multi-tenant basado en **`orgId` + custom claims** de Firebase Auth:

- `organizaciones/{orgId}` (la clínica) y `miembros/{uid}` (`{ orgId, rol }`, rol ∈
  `admin | vet | asistente`).
- Al crear org / asignar miembro, la API setea **custom claims** `{ orgId, rol }` en el usuario. Esos
  claims viajan en el **ID token**, así que tanto las reglas como la API conocen el tenant **sin
  lookup extra**.
- Las colecciones de negocio (`pacientes`, `consultas`, `citas`, `brigadas`) ganan `orgId`, pero
  **mantienen `veterinarioId`** por compatibilidad.
- El aislamiento se aplica con el mismo criterio en los dos lados: `firestore.rules` (helpers
  `ownsByVet`, `hasOrgClaim`, etc.) y `assertAcceso` en la API. Patrón **doble modo**: primero
  `orgId`, y si el doc no lo tiene, fallback legacy a `veterinarioId == uid`.

## Consecuencias

**Positivas:**

- Aislamiento por tenant **sin lecturas extra**: el `orgId` y el `rol` están en el token.
- Convivencia sin dolor: datos viejos (solo `veterinarioId`) y nuevos (con `orgId`) funcionan a la
  vez gracias al fallback. La migración puede ser gradual.
- Roles (`admin/vet/asistente`) habilitan permisos finos (p. ej. solo admin borra/gestiona miembros).
- Mismo criterio de seguridad en reglas y API → menos chances de discrepancias.

**Negativas / costos:**

- Los custom claims **no se actualizan solos**: tras setearlos, el usuario necesita refrescar su ID
  token para que el cambio surta efecto. Hay que tenerlo en cuenta al cambiar de org/rol.
- El fallback legacy (`veterinarioId == uid`) **afloja** el aislamiento para docs sin `orgId`. Es
  deliberado durante la migración, pero hay que **retirarlo** cuando todo tenga `orgId` para cerrar
  del todo.
- Requiere una migración de datos (idempotente + reversible) para backfillear `orgId` y crear
  miembros/claims desde los veterinarios existentes.

> El almacenamiento todavía no está particionado por tenant (`historiales/{consultaId}.pdf` sin
> `orgId` en la ruta). Endurecimiento futuro: `historiales/{orgId}/{consultaId}.pdf`.
