# Decision de scope para admin.veterinaria@vethosia.com

## Decision

No crear todavia el usuario `admin.veterinaria@vethosia.com`.

El usuario no debe existir en Auth ni recibir claims hasta que produccion tenga un `veterinariaId`
real y un scope V2 suficiente para representar correctamente a un `admin_veterinaria`.

Actualizacion local: el repo ya contiene soporte aditivo para resolver `role=admin_veterinaria`,
crear `veterinarias/{veterinariaId}` local/emulado, persistir membresias V2 y mostrar UI de
veterinaria. Esta decision sigue vigente para produccion porque aun falta crear/backfillear el
scope real y validar smokes contra datos productivos.

## Motivo

El rol `admin_veterinaria` requiere un contexto de veterinaria/sede concreto. En el estado actual de
produccion no existe un `veterinariaId` confiable que permita separar esa vista de la vista de
entidad.

Crear el usuario antes de ese scope haria que el sistema tenga que inferir permisos desde datos
legacy incompletos. Esa inferencia es insegura para una entrega controlada.

## Estado actual de produccion

- `admin.veterinaria@vethosia.com` no existe en Firebase Auth.
- No hay documentos en `veterinarias/`.
- No hay documentos en `entidades/`.
- No hay miembros con `veterinariaId`.
- No hay data clinica con `veterinariaId`.
- La data clinica actual vive por `orgId` legacy.
- `/v1/me` del codigo local ya hidrata `role=admin_veterinaria`; produccion debe actualizarse solo
  despues de preparar `veterinariaId` real y validar el deploy controlado.

## Riesgo de crearlo ahora

Si se crea `admin.veterinaria@vethosia.com` con `role=admin_veterinaria` y `rol=admin`, la UI y
algunos flujos legacy podrian interpretarlo como `admin_entidad`.

Ese resultado seria incorrecto porque:

- mostraria capacidades de entidad cuando el usuario deberia estar limitado a una veterinaria/sede;
- podria confundir la validacion funcional contra el PDF;
- dejaria una cuenta final con permisos ambiguos;
- haria mas dificil distinguir un error de claims de un error real de producto.

## Pre-requisitos antes de crear el usuario

1. Decidir cual es el `orgId` principal que se va a clasificar como entidad o veterinaria.
2. Crear o backfillear `veterinarias/{veterinariaId}` con mapping revisado.
3. Definir si la veterinaria hereda plan de entidad o es `planOwner` propio.
4. Verificar `/v1/me` en produccion para exponer el `role` V2 y los campos de scope necesarios:
   - `role=admin_veterinaria`
   - `accountId`
   - `accountType`
   - `veterinariaId`
   - `entidadId` si aplica
   - `membershipId`
   - `planOwnerType`
   - `planOwnerId`
   - `orgId` / `rol` legacy solo como compatibilidad
5. Validar frontend con fixture real de `admin_veterinaria`.
6. Validar API con tests/smoke de aislamiento por `veterinariaId`.
7. Crear el usuario y password solo despues de que los puntos anteriores esten verificados.

## Plan dry-run antes de usuario real

1. Exportar inventario read-only de `organizaciones`, `pacientes`, `consultas`, `citas`, `vacunas`,
   `brigadas`, `suscripciones` y `miembros` filtrado por `orgId`.
2. Clasificar manualmente cada `orgId` candidato:
   - `GT1BZb...`: decidir si representa entidad, veterinaria independiente o caso ambiguo.
   - `iVQURl...`: decidir si representa entidad, veterinaria independiente o caso ambiguo.
3. Para cada `orgId` clasificado como veterinaria, simular `veterinarias/{veterinariaId}` con:
   `nombre`, `orgId`, `legacyOrgId`, `entidadId?`, `planOwnerType`, `planOwnerId`, `estado`,
   `createdAt`, `updatedAt`.
4. Para cada `orgId` clasificado como entidad, simular `entidades/{entidadId}` y las veterinarias
   hijas necesarias; si no se puede inferir la sede, marcar `needs_review`.
5. Simular mappings V2 para documentos clinicos:
   - `accountType=veterinaria`
   - `accountId=veterinariaId`
   - `veterinariaId=veterinariaId`
   - `entidadId` solo si aplica
   - `planOwnerType` y `planOwnerId` segun la decision de plan.
6. Simular `miembros/{membershipId}` para `admin_veterinaria@vethosia.com` sin crear usuario Auth:
   `role=admin_veterinaria`, `rol=admin`, `accountType=veterinaria`, `accountId=veterinariaId`,
   `veterinariaId`, `entidadId?`, `planOwnerType`, `planOwnerId`, `orgId` legacy.
7. Validar que una segunda corrida dry-run produce el mismo reporte y no cambia mappings revisados.
8. Ejecutar smokes locales/emulados de `/v1/me`, navegacion, suscripcion heredada/propia e
   invitacion de veterinarios.
9. Solo despues de aprobacion manual: crear/backfillear scope real, refrescar claims y crear el
   usuario final.

## Usuarios finales actuales

Los usuarios finales habilitados para la entrega controlada actual son:

- `superadmin@vethosia.com`
- `gerencia@vethosia.com`
- `veterinario@vethosia.com`

## Roles no habilitados como usuarios nuevos

- `asistente` no se debe reactivar. Queda solo como legacy/deprecated, sin permisos V2 nuevos.
- `sistema` no es usuario Auth. Solo puede usarse como actor interno de jobs, auditoria y procesos
  automaticos server-side.

## Criterio de salida

`admin.veterinaria@vethosia.com` podra crearse cuando exista evidencia de:

- `veterinariaId` real en produccion;
- membership V2 persistido con scope completo;
- `/v1/me` devolviendo el role/scope V2 correcto;
- UI mostrando solo modulos de veterinaria;
- API negando acceso cruzado fuera de esa veterinaria;
- pruebas o smokes verdes para el flujo `admin_veterinaria`.
