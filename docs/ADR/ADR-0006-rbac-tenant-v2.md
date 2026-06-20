# ADR-0006 - Modelo RBAC y tenant jerarquico V2

Estado: Propuesto para implementacion, no aplicado en runtime
Fecha: 2026-06-17
Autores: Staff Engineering / Product Architecture
Decision drivers: auditoria funcional V2 basada en `Funcionalidades x rol.pdf`, `docs/SCOPE_V2_GAP_ANALYSIS.md`, `docs/RBAC_TENANT_MODEL_V2.md`, `docs/STATE_MACHINES_AND_TRIGGERS_V2.md`, `docs/IMPLEMENTATION_ROADMAP_V2.md`, `docs/NEXT_PROMPTS_FOR_CURSOR_AND_CODEX.md`

## Contexto

El sistema actual resuelve tenant y RBAC con un modelo plano:

- Auth/API reconoce `superadmin`, `admin`, `vet` y `asistente`.
- El aislamiento principal usa `orgId`; si no existe `orgId`, algunos flujos caen al scope legacy `vet_{uid}` o a `veterinarioId`.
- `api/src/common/auth/access.ts` autoriza por `orgId` primero y despues por fallback legacy.
- `api/src/modules/tenant/*` administra `organizaciones/{orgId}` y `miembros/{uid}` con un solo rol por usuario.
- `api/src/modules/saas/*` calcula suscripcion y consumo por `orgId` o `vet_{uid}`.
- `firestore.rules` y `storage.rules` estan centradas en `orgId` mas compatibilidad legacy.
- `functions/` conserva callables legacy, incluyendo un contador HC global en `configuracion/contadorHC`.
- `frontend/src/lib/rbac.ts` expone el rol `admin` con etiqueta "Admin Entidad", aunque el backend no distingue `admin_entidad` de `admin_veterinaria`.

La auditoria V2 detecta una brecha de producto: el PDF exige una jerarquia operativa que el modelo plano no puede expresar sin ambiguedades:

- Entidad.
- Veterinaria/Hospital.
- Veterinario independiente.
- Veterinario freelance vinculado a entidad.
- Admin Entidad.
- Admin Veterinaria.
- Super Admin.
- Sistema.

Esta decision no modifica codigo, reglas, migraciones ni datos. Define el contrato tecnico que debe guiar las siguientes fases.

## Decision recomendada

Migrar a roles explicitos para los administradores de scope:

- `superadmin`
- `admin_entidad`
- `admin_veterinaria`
- `veterinario`

`sistema` no es rol humano ni claim asignable; es actor tecnico server-side para jobs, auditoria, backfills, triggers y tareas programadas. `asistente` queda fuera del modelo canonico V2: puede existir solo como `rol` legacy/deprecated durante la transicion, sin permisos V2 nuevos y sin poder crearse por invitaciones o altas nuevas.

No se debe mantener `admin` como rol canonico V2 con `scopeType` solamente. Durante la transicion, `admin` puede seguir existiendo como rol legacy y debe mapearse de forma conservadora mediante una tabla de backfill. El runtime V2 debe tomar decisiones con `role` explicito y con campos de scope canonicos.

La decision separa tres conceptos que hoy estan mezclados:

1. **Scope clinico o cuenta duena del paciente**: donde vive el paciente y su historia.
2. **Scope jerarquico**: entidad y/o veterinaria que determinan visibilidad.
3. **Owner del plan**: quien paga y contra quien se imputan cupos/consumo.

Esta separacion mantiene el principio del PDF: el paciente pertenece a la cuenta, no al veterinario individual que lo atendio.

## Alternativas consideradas

### A. Mantener `admin` + `scopeType`

Descartada como modelo canonico.

Ventajas:

- Menos cambios iniciales en guards y UI.
- Permite reutilizar parte del contrato actual.

Problemas:

- El guard jerarquico actual trata `admin` como un rol unico e inclusivo sobre `vet/asistente`; no distingue administracion de entidad versus veterinaria.
- El frontend ya etiqueta `admin` como "Admin Entidad", lo que oculta si el usuario realmente administra una veterinaria independiente.
- Las auditorias, reglas negativas y trazabilidad quedan menos legibles porque el permiso depende de una combinacion implicita de rol y scope.
- Es mas facil introducir acceso cruzado entre sedes, entidades y veterinarios freelance.

### B. Roles explicitos + scopes canonicos

Seleccionada.

Ventajas:

- El permiso humano se lee directamente desde el rol.
- Las reglas negativas son mas claras: `admin_entidad` no equivale a `admin_veterinaria`.
- Permite mapear el PDF sin depender de convenciones en texto o UI.
- Hace auditable la transicion desde el rol legacy `admin`.

Costos:

- Requiere migracion de claims, guards, reglas, UI y pruebas.
- Requiere doble compatibilidad temporal con `rol`/`orgId` legacy.

### C. Colecciones anidadas por jerarquia

Descartada para V2 inicial.

Ejemplo: `entidades/{entidadId}/veterinarias/{veterinariaId}/pacientes/{pacienteId}`.

Problemas:

- Complica queries transversales, reportes, indices, migracion y coexistencia con colecciones actuales.
- Aumenta el blast radius de Firestore rules.
- No resuelve por si misma el caso de veterinario independiente o freelance vinculado a entidad.

Se recomienda conservar colecciones top-level con campos canonicos de scope e indices compuestos.

### D. Big bang migration

Descartada.

La produccion debe migrar con doble escritura/lectura, backfill idempotente, flags de rollout y rollback por claims/fields legacy.

## Modelo conceptual

### Entidades de negocio

| Concepto | Descripcion | Scope clinico | Owner de plan posible |
|---|---|---:|---:|
| Veterinario independiente | Profesional que opera su propia cuenta | `accountType=vet_individual`, `accountId=vet_{uid}` | Si |
| Veterinaria/Hospital independiente | Clinica sin entidad superior | `accountType=veterinaria`, `accountId={veterinariaId}` | Si |
| Entidad | Grupo/empresa que administra una o mas veterinarias y/o freelance | No siempre es scope clinico directo | Si |
| Veterinaria/Hospital de entidad | Sede o clinica bajo una entidad | `accountType=veterinaria`, `accountId={veterinariaId}`, `entidadId` presente | Puede heredar de entidad |
| Veterinario freelance vinculado a entidad | Profesional asociado a entidad sin pertenecer a una veterinaria concreta | `accountType=entidad`, `accountId={entidadId}`, `vinculoTipo=freelance` | Hereda de entidad |

Regla central:

- `accountId` es el dueno clinico del paciente.
- `veterinarioId` es actor, responsable o asignado, pero no propietario unico del paciente.
- `planOwnerId` es el scope de facturacion/consumo y puede diferir de `accountId`.

## Modelo de colecciones/documentos propuesto

No se deben renombrar ni borrar colecciones legacy en la primera fase. Los campos V2 se agregan de forma compatible.

### `entidades/{entidadId}`

| Campo | Tipo | Uso |
|---|---|---|
| `nombre` | string | Nombre visible de la entidad |
| `estado` | `activa`/`suspendida`/`archivada` | Control operativo |
| `planOwnerType` | `entidad` | Billing canonico si la entidad paga |
| `planOwnerId` | string | Igual a `entidadId` si paga entidad |
| `createdAt` / `updatedAt` | timestamp | Auditoria |
| `legacyOrgId` | string opcional | Mapeo si proviene de `organizaciones/{orgId}` |

### `veterinarias/{veterinariaId}`

| Campo | Tipo | Uso |
|---|---|---|
| `nombre` | string | Nombre de sede/clinica/hospital |
| `entidadId` | string opcional | Presente si pertenece a entidad |
| `accountType` | `veterinaria` | Tipo de cuenta clinica |
| `accountId` | string | Igual a `veterinariaId` |
| `planOwnerType` | `veterinaria`/`entidad` | Define si paga la clinica o hereda de entidad |
| `planOwnerId` | string | `veterinariaId` o `entidadId` |
| `estado` | string | Activa/suspendida/archivada |
| `legacyOrgId` | string opcional | Compatibilidad con `orgId` |

### `miembros/{membershipId}`

El modelo actual `miembros/{uid}` solo soporta una membresia por usuario. V2 debe usar un identificador de membresia para soportar multiples contextos y evitar sobrescribir claims.

| Campo | Tipo | Uso |
|---|---|---|
| `uid` | string | Usuario Firebase Auth |
| `role` | enum V2 | Rol canonico |
| `legacyRol` | string opcional | Rol anterior para rollback |
| `entidadId` | string opcional | Scope de entidad |
| `veterinariaId` | string opcional | Scope de veterinaria |
| `accountType` | enum | `vet_individual`, `veterinaria`, `entidad` |
| `accountId` | string | Cuenta clinica activa |
| `planOwnerType` | enum | `vet`, `veterinaria`, `entidad` |
| `planOwnerId` | string | Owner de suscripcion/consumo |
| `vinculoTipo` | enum opcional | `staff`, `freelance`, `owner` |
| `estado` | enum | `invitado`, `activo`, `bloqueado`, `revocado` |
| `createdAt` / `updatedAt` | timestamp | Auditoria |

### Documentos clinicos top-level

Aplica a `pacientes`, `consultas`, `citas`, `vacunas`, `enmiendas`, `brigadas`, documentos de Storage relacionados e historiales exportados.

| Campo | Tipo | Uso |
|---|---|---|
| `accountId` | string | Dueno clinico del paciente/documento |
| `accountType` | enum | Tipo de cuenta clinica |
| `entidadId` | string opcional | Agregacion y visibilidad de entidad |
| `veterinariaId` | string opcional | Sede/clinica propietaria |
| `veterinarioId` | string | Actor o profesional responsable |
| `createdByUid` | string | Usuario creador |
| `updatedByUid` | string opcional | Ultimo editor |
| `planOwnerType` | enum | Owner de consumo aplicable |
| `planOwnerId` | string | Scope de consumo/cuota |
| `legacyOrgId` / `orgId` | string opcional | Compatibilidad temporal |

Regla de migracion:

- `orgId` se preserva durante V2.
- Los nuevos servicios deben escribir `accountId`/`accountType`/`planOwnerId`.
- Los lectores deben preferir V2 y usar `orgId` solo como fallback hasta cerrar la migracion.

### `suscripciones` y `consumos`

Las suscripciones deben colgar logicamente del owner del plan, no necesariamente del scope clinico.

| Campo | Tipo | Uso |
|---|---|---|
| `planOwnerType` | `vet`/`veterinaria`/`entidad` | Quien paga |
| `planOwnerId` | string | Identificador canonico |
| `entidadId` | string opcional | Agregacion |
| `veterinariaId` | string opcional | Si aplica |
| `veterinarioId` | string opcional | Si aplica a independiente |
| `estado` | enum | Estado de suscripcion |
| `planId` | string | Plan contratado |
| `limites` | map | Cupos vigentes |
| `legacyOrgId` / `orgId` | string opcional | Compatibilidad |

Consumo:

- Documento canonico: `consumos/{planOwnerId}_{periodo}`.
- Dimensiones de auditoria: `periodo`, `planOwnerType`, `planOwnerId`, `entidadId`, `veterinariaId`, `veterinarioId`, `accountId`.
- Para reportes, se pueden mantener rollups derivados por veterinario, veterinaria y entidad, pero la cuota se descuenta contra `planOwnerId`.

## Modelo de claims propuesto

Los custom claims deben permanecer pequenos. No deben contener listas grandes de sedes, pacientes o permisos. Para usuarios con multiples membresias, el claim representa el contexto activo y el API debe validar contra Firestore.

```json
{
  "v": 2,
  "role": "admin_veterinaria",
  "accountType": "veterinaria",
  "accountId": "vetclin_123",
  "entidadId": "ent_123",
  "veterinariaId": "vetclin_123",
  "membershipId": "m_123",
  "planOwnerType": "entidad",
  "planOwnerId": "ent_123",
  "orgId": "legacy_org_123",
  "rol": "admin"
}
```

Notas:

- `role` es canonico V2.
- `rol` y `orgId` se conservan temporalmente para codigo/rules legacy.
- `superadmin` no requiere `accountId`, pero los endpoints deben exigir intencion explicita para operar sobre un scope.
- `sistema` no debe asignarse a usuarios humanos. Debe usarse en auditoria server-side para jobs, backfills, triggers y tareas programadas.
- `asistente` no es `role` V2 valido. Si aparece como `rol` legacy, debe quedar restringido y sin permisos V2 nuevos.
- Si un usuario cambia de contexto activo, se actualiza `membershipId` y scopes asociados en claims, y el cliente debe refrescar token.

## Matriz de permisos por rol

| Rol | Alcance principal | Puede administrar miembros | Puede ver pacientes | Puede operar planes | Notas |
|---|---|---:|---:|---:|---|
| `superadmin` | Plataforma | Si, con auditoria | Si, solo por soporte/operacion explicita | Si | No debe depender de `orgId`; todo acceso debe quedar auditado |
| `admin_entidad` | `entidadId` | Si, dentro de entidad | Si, en veterinarias/freelance de la entidad | Si, si `planOwnerId=entidadId` | No puede ver otra entidad |
| `admin_veterinaria` | `veterinariaId` o veterinaria independiente | Si, dentro de veterinaria | Si, en su `accountId` | Si, si la veterinaria es owner del plan | No puede ver sedes hermanas |
| `veterinario` | Membresia activa | No, salvo funciones delegadas futuras | Si, segun cuenta/asignacion | No, salvo plan individual propio | Es actor clinico, no dueno automatico del paciente |

Fuera de la tabla de roles humanos, `sistema` opera solo como actor interno server-side. El rol legacy `asistente` no debe mapearse a `veterinario`, no debe recibir `role` V2 y no debe poder ser invitado/creado en altas nuevas.

## Reglas de visibilidad por scope

Las reglas V2 deben evaluar primero campos canonicos. El fallback legacy solo existe durante migracion.

1. `superadmin` puede operar globalmente solo en endpoints/rutas de soporte con auditoria.
2. `admin_entidad` puede leer/escribir documentos con `entidadId == claim.entidadId`.
3. `admin_veterinaria` puede leer/escribir documentos con `veterinariaId == claim.veterinariaId` y `accountId == claim.accountId`.
4. Veterinaria independiente usa `entidadId = null`, `veterinariaId = accountId`, `planOwnerId = accountId`.
5. Veterinario independiente usa `accountType=vet_individual`, `accountId=vet_{uid}`, `planOwnerId=vet_{uid}`.
6. Veterinario freelance de entidad usa `entidadId`, `veterinariaId = null`, `accountId = entidadId`, `planOwnerId = entidadId`, `vinculoTipo=freelance`.
7. `veterinarioId` sirve para asignacion, auditoria y filtros, pero no reemplaza `accountId`.
8. Ningun usuario de una entidad puede acceder por conocer un `pacienteId`, `consultaId`, archivo de Storage o `orgId` externo.
9. Las invitaciones deben incluir `role`, `entidadId`, `veterinariaId`, `accountId`, `planOwnerId` y `vinculoTipo`; aceptar una invitacion no debe inferir scope desde el cliente.
10. Storage debe usar paths con `accountId` o campos validados por metadatos server-side; `historiales/{orgId}` queda como compatibilidad hasta migrar.

## Owner del plan y consumo

### Veterinario independiente

- `accountId = vet_{uid}`
- `planOwnerType = vet`
- `planOwnerId = vet_{uid}`
- Consumo se incrementa en `consumos/{vet_{uid}}_{periodo}`.

### Veterinaria/Hospital independiente

- `accountId = veterinariaId`
- `planOwnerType = veterinaria`
- `planOwnerId = veterinariaId`
- Los veterinarios vinculados imputan consumo al plan de la veterinaria.
- Los reportes por veterinario usan `veterinarioId` como dimension, no como owner.

### Entidad con veterinarias

- Entidad paga: `planOwnerType = entidad`, `planOwnerId = entidadId`.
- Cada veterinaria mantiene `accountId = veterinariaId` para pacientes e HC.
- Consumo se imputa a entidad y se dimensiona con `veterinariaId` y `veterinarioId`.

### Veterinario freelance vinculado a entidad

- `accountType = entidad`
- `accountId = entidadId`
- `planOwnerType = entidad`
- `planOwnerId = entidadId`
- `veterinariaId = null`
- El paciente queda en la cuenta de la entidad, no en la cuenta personal del freelance.

## Principio: paciente pertenece a la cuenta

Todo documento clinico debe responder:

- A que cuenta clinica pertenece: `accountId`.
- Que nivel jerarquico lo puede ver: `entidadId` y/o `veterinariaId`.
- Quien actuo: `veterinarioId`, `createdByUid`, `updatedByUid`.
- Contra que plan consume: `planOwnerId`.

Por tanto:

- Si un veterinario sale de una veterinaria, los pacientes no se mueven a su cuenta personal.
- Si un freelance deja una entidad, los pacientes siguen perteneciendo a la entidad.
- Si un admin de entidad cambia de rol, los pacientes no cambian de owner.
- Transferencias de ownership deben ser operaciones explicitas, auditadas y fuera del flujo normal.

## Plan de migracion y backfill

### Fase 0 - Preparacion documental y pruebas

- Mantener codigo, rules y datos sin cambios.
- Crear pruebas negativas esperadas antes de modificar runtime.
- Definir tabla de clasificacion legacy: cada `organizaciones/{orgId}` debe clasificarse como `veterinaria_independiente`, `entidad` o caso manual.
- Definir mapping de usuarios `admin` a `admin_entidad` o `admin_veterinaria`. No inferir automaticamente si no hay evidencia.

### Fase 1 - Campos V2 y doble compatibilidad

- Agregar soporte en API para escribir campos V2 en documentos nuevos.
- Conservar `orgId` y `rol` legacy.
- Claims V2 deben incluir `role` y tambien claims legacy hasta que frontend/rules migren.
- Los lectores deben preferir `accountId` y usar `orgId` solo como fallback.

### Fase 2 - Backfill idempotente

Reglas de backfill recomendadas:

- Documentos con `orgId`: buscar mapping de `orgId`.
  - Si mapea a veterinaria independiente: `accountType=veterinaria`, `accountId=veterinariaId`, `veterinariaId=veterinariaId`, `planOwnerId=veterinariaId`.
  - Si mapea a entidad: `entidadId=entidadId`, y solo usar `accountId=entidadId` para freelance/directo; para sedes, usar `accountId=veterinariaId`.
- Documentos sin `orgId` y con `veterinarioId`: `accountType=vet_individual`, `accountId=vet_{veterinarioId}`, `planOwnerId=vet_{veterinarioId}`.
- Si faltan datos suficientes, marcar `migrationStatus=needs_review` y no inventar scope.
- Registrar `migrationVersion`, `migrationRunId`, `migratedAt` y snapshot de campos anteriores para auditoria.

### Fase 3 - Rules/API V2 en modo enforced

- Cambiar guards server-side para validar V2.
- Cambiar Firestore/Storage rules despues de tener pruebas negativas.
- Deshabilitar rutas directas frontend que dependan de autorizacion cliente-side.
- Mantener fallback legacy detras de flag mientras existan documentos sin backfill completo.

### Fase 4 - Retiro controlado de legacy

- Retirar `admin` como rol canonico solo cuando no existan sesiones activas ni miembros sin mapping.
- Retirar fallback `orgId` despues de completar backfill, verificacion y periodo de observacion.
- Retirar `functions/` legacy solo despues de reemplazar callables y contadores.

## Compatibilidad con legacy

### `orgId` y `rol`

- Se preservan en claims y documentos durante la migracion.
- Nunca deben ser la fuente primaria de autorizacion V2 una vez activado el flag.
- Deben quedar disponibles para rollback.

### `functions/`

`functions/` conserva comportamiento legacy para compatibilidad. No debe crecer para cubrir V2.

Riesgo principal:

- `generarNumeroHC` usa `configuracion/contadorHC`, un contador global. V2 necesita contador por cuenta clinica, por ejemplo `configuracion/contadorHC_{accountId}` o una coleccion equivalente transaccional.

Decision:

- Mantener el contador global solo para flujos legacy.
- Implementar contador HC V2 en API server-side, usando `accountId` como particion.
- Para veterinarias bajo entidad, la secuencia pertenece a la veterinaria (`accountId=veterinariaId`), no al plan owner.
- Para freelance directo de entidad, la secuencia pertenece a la entidad (`accountId=entidadId`).

## Plan de rollback

Rollback debe ser posible sin borrar campos V2.

1. Apagar flags V2 en API/Frontend.
2. Volver a validar con `orgId`/`rol` legacy.
3. Reescribir custom claims legacy desde snapshot de membresias si una migracion de claims falla.
4. Pausar jobs de backfill por `migrationRunId`.
5. Mantener documentos con campos V2 agregados; no eliminarlos durante incidente.
6. Revertir rules solo si ya fueron desplegadas; tener version anterior exportada.
7. Recalcular consumo desde eventos/auditoria si el fallo afecto `planOwnerId`.

## Riesgos P0

| Riesgo | Impacto | Mitigacion requerida |
|---|---|---|
| Mapear `admin` al scope equivocado | Acceso cruzado o perdida de admin | Tabla manual de clasificacion y prueba por tenant |
| Autorizar por `veterinarioId` como owner | Pacientes se fugan al vet individual | Tests negativos y campos `accountId` obligatorios |
| Consumo imputado al scope incorrecto | Cobros/cupos erroneos | Validar `planOwnerId` en cada operacion consumible |
| Claims stale despues de cambio de membresia | Usuario conserva permisos viejos | Refresh token obligatorio y revocacion cuando aplique |
| Firestore direct legacy sigue habilitado | Bypass del API | Migrar reglas y bloquear writes cliente-side sensibles |
| Contador HC global | Numeracion mezclada entre cuentas | Contador por `accountId` antes de activar V2 clinico |
| Multiples membresias por usuario | Contexto activo ambiguo | `membershipId` canonico y selector de contexto auditado |
| Backfill incompleto | Mezcla de documentos V1/V2 | `migrationStatus`, reportes de cobertura y fallback limitado |

## Tests negativos requeridos antes de codigo

1. `admin_entidad` de entidad A no puede leer ni escribir documentos de entidad B.
2. `admin_veterinaria` de sede A no puede leer sede B de la misma entidad.
3. `admin_veterinaria` no puede operar plan si `planOwnerId` pertenece a entidad.
4. Veterinario freelance de entidad no puede ver pacientes de una veterinaria de esa entidad salvo asignacion explicita.
5. Veterinario de veterinaria no puede ver pacientes freelance directos de la entidad salvo asignacion explicita.
6. Veterinario que sale de una cuenta no conserva acceso a pacientes historicos por `veterinarioId`.
7. Asistente no puede aprobar/firmar acciones clinicas reservadas al vet.
8. Documento clinico nuevo sin `accountId` debe rechazarse.
9. Documento con `accountId` y `entidadId` inconsistentes debe rechazarse.
10. Consumo de veterinaria bajo entidad incrementa `planOwnerId=entidadId` y conserva dimension `veterinariaId`.
11. Consumo de veterinaria independiente incrementa `planOwnerId=veterinariaId`.
12. Consumo de vet independiente incrementa `planOwnerId=vet_{uid}`.
13. Storage no permite leer `historiales` ni fotos por path de otra cuenta.
14. Invitacion manipulada por cliente no puede cambiar `role` ni `accountId`.
15. Claims legacy `admin` sin mapping V2 no otorgan permisos V2.
16. Superadmin requiere ruta de soporte auditada; no debe pasar por accidente en endpoints tenant normales.
17. Backfill repetido no cambia documentos ya migrados ni duplica consumo.
18. Rollback de claims restaura `orgId`/`rol` y no elimina campos V2.
19. Callable legacy de `functions/` no genera contador HC V2.
20. Reglas Firestore niegan escritura cliente directa a campos de billing/scope canonico.

## Prompts siguientes para implementacion

### Para Codex

1. Crear tests unitarios backend de `AuthUser`, guards y `access.ts` para roles V2 y casos negativos, sin cambiar reglas todavia.
2. Disenar y probar helpers server-side `resolveMembershipContext`, `assertScopeAccess` y `assertPlanOwnerAccess`.
3. Crear migracion dry-run/idempotente para clasificar `organizaciones` y reportar casos ambiguos sin escribir datos.
4. Crear tests de consumo SaaS para `planOwnerId` por vet, veterinaria y entidad.
5. Crear especificacion de Firestore/Storage rules V2 con pruebas de emulador antes de desplegar.

### Para Cursor

1. Actualizar tipos y UI de roles despues de que el contrato API V2 este definido.
2. Agregar selector de contexto activo si un usuario tiene multiples membresias.
3. Cambiar pantallas de administracion para diferenciar Admin Entidad y Admin Veterinaria.
4. Ajustar copy y navegacion para freelance/entidad/veterinaria sin exponer decisiones de autorizacion al cliente.
5. Validar que checkout y planes consuman solo contratos server-side, sin claves ni reglas de tenant en frontend.

## Consecuencias

Esta ADR acepta una migracion mas explicita y pesada, pero reduce el riesgo de seguridad y facturacion. La arquitectura V2 queda guiada por scopes canonicos:

- `accountId` para ownership clinico.
- `entidadId`/`veterinariaId` para visibilidad jerarquica.
- `planOwnerId` para billing y consumo.
- `membershipId` para contexto activo.
- `role` explicito para permisos humanos.

Hasta que se implemente, el sistema sigue operando con `orgId` y roles legacy.
