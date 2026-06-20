# RBAC y modelo tenant V2

Fuente funcional: `Funcionalidades x rol.pdf` revisado visualmente, paginas 2-29.  
Fuente tecnica: `agents.md`, `.cursor/rules/*`, `api/src/common/auth/*`, `firestore.rules`, `storage.rules`, `api/src/modules/*`, `frontend/src/lib/rbac.ts`.

## Principio rector

El PDF define que el paciente pertenece a la **cuenta**, no al veterinario individual que lo atendio. En V2, toda decision de permisos debe resolverse primero por el scope de cuenta y despues por el rol. El `uid` del veterinario sirve para autoria, agenda individual y metricas personales; no debe ser el owner principal de datos clinicos cuando existe una cuenta.

## Roles canonicos propuestos

| Rol V2 | Equivalente actual | Proposito | Estado actual |
|---|---|---|---|
| `superadmin` | `superadmin` | Equipo interno Vethos: cuentas, planes, cobros, metricas globales, auditoria, configuracion. | Parcial |
| `admin_entidad` | hoy se usa `admin` | Administra una entidad/gobierno/cadena/ONG con veterinarias y vets freelance. | Parcial/fusionado |
| `admin_veterinaria` | `admin` legacy + `role=admin_veterinaria` | Administra una clinica/hospital y sus veterinarios. | Soporte local aditivo; pendiente backfill prod |
| `veterinario` | `vet` | Usuario clinico que atiende pacientes, consultas, agenda, vacunas y PDF. | Parcial |

Fuera de los roles humanos canonicos:

- `sistema` es actor interno para jobs automaticos, consumo, suscripcion, recordatorios, pagos y auditoria. No debe existir como usuario Auth ni como `role` asignable.
- `asistente` existe solo como `rol` legacy/deprecated si hay datos antiguos. No se debe mapear a `veterinario`, no puede invitarse/crearse de nuevo y no recibe permisos V2 nuevos.

Decision aplicada: los claims V2 usan roles explicitos (`admin_entidad`, `admin_veterinaria`, `veterinario`, `superadmin`) y conservan `rol` legacy solo como compatibilidad. Cuando `role=admin_veterinaria` convive con `rol=admin`, el sistema debe resolverlo como Admin Veterinaria, nunca como Admin Entidad.

## Modelo de cuentas

| Cuenta | Owner del plan | Contiene | Datos que ve |
|---|---|---|---|
| Veterinario individual | El veterinario | Pacientes, citas, consultas, vacunas, pagos propios. | Solo sus datos. |
| Veterinaria/Hospital independiente | Admin Veterinaria | Veterinarios miembros, pacientes de la clinica, plan propio. | Datos de la clinica. |
| Veterinaria bajo entidad | Entidad | Veterinarios de la sede, pacientes de la sede. | Admin veterinaria ve sede; entidad ve consolidado. |
| Entidad | Admin Entidad | Varias veterinarias y vets freelance. | Consolidado por cadena, sede y vet freelance. |

Modelo actual: `organizaciones/{orgId}` + `miembros/{uid}` + docs de negocio con `orgId`. Esto soporta una cuenta plana, pero no la jerarquia del PDF.

## Reglas de pertenencia

1. Cada documento clinico nuevo debe tener `orgId` o un scope equivalente V2 obligatorio.
2. Si el usuario no tiene `orgId`, se permite temporalmente `vet_{uid}` para veterinario independiente legacy.
3. Pacientes, consultas, citas, vacunas, brigadas, PDF y auditoria deben guardar el scope de cuenta y el actor.
4. El veterinario vinculado puede atender dentro del scope asignado, pero al salir/desactivarse los pacientes e historias permanecen en la cuenta.
5. El Super Admin cruza tenants solo en endpoints declarados con `@Roles('superadmin')` y auditoria.
6. El Admin Entidad no debe editar datos personales de veterinarios, solo activar/desactivar/vincular y ver metricas permitidas.
7. El Admin Veterinaria no debe ver sedes hermanas ni entidades no vinculadas.

## Scope Admin Veterinaria V2

Un `admin_veterinaria` valido requiere estos campos:

| Campo | Regla |
|---|---|
| `role` | Siempre `admin_veterinaria`; no se deriva desde `rol=admin`. |
| `rol` legacy | `admin`, solo para compatibilidad con endpoints que aun aceptan roles cortos. |
| `accountType` | `veterinaria`. |
| `accountId` | Igual a `veterinariaId`. |
| `veterinariaId` | Sede/clinica administrada. Es obligatorio. |
| `entidadId` | Opcional si la veterinaria pertenece a una entidad. |
| `planOwnerType` | `veterinaria` si la clinica paga; `entidad` si hereda plan. |
| `planOwnerId` | `veterinariaId` cuando paga la clinica; `entidadId` cuando hereda plan. |
| `membershipId` | Documento `miembros/{membershipId}` que vincula usuario, rol y scope. |
| `orgId` | Legacy de compatibilidad para datos aun no backfilleados. |

Permisos especificos:

- Puede ver y operar pacientes, citas, consultas, vacunas, metricas y equipo de su `veterinariaId`.
- Puede invitar veterinarios a su propia veterinaria; el cliente no decide rol ni scope efectivo.
- No puede listar miembros de toda la entidad ni bloquear miembros globales desde endpoints legacy.
- No puede entrar a plataforma/soporte ni actuar como `superadmin`.
- Puede gestionar suscripcion y Wompi solo si `planOwnerType=veterinaria` y `planOwnerId=veterinariaId`.
- Si `planOwnerType=entidad`, ve la suscripcion como estado heredado de solo lectura.

## Permisos por rol

| Accion | Veterinario | Admin Veterinaria | Admin Entidad | Super Admin | Sistema |
|---|---|---|---|---|---|
| Crear paciente | Si, en su cuenta | Si/delegado | No directo salvo operacion administrativa | Soporte excepcional auditado | No |
| Editar paciente | Si, si pertenece a su cuenta | Si, en su veterinaria | Solo lectura consolidada salvo regla definida | Soporte excepcional auditado | No |
| Archivar paciente | Si, si permisos de cuenta lo permiten | Si | No por defecto | Si, auditado | No |
| Crear consulta/SOAP | Si | No como flujo principal | No | No | Procesa IA |
| Aprobar historia | Veterinario/admin clinico | Si solo si es profesional autorizado o regla decidida | No por defecto | No por defecto | No |
| Exportar PDF | Si, solo aprobada | Si, sobre historias de su veterinaria | Lectura consolidada segun politica | Si auditado | Puede generar en job |
| Invitar vets | No | Si a su veterinaria | Si a entidad o sede | Si | No |
| Gestionar plan | Solo independiente | Solo veterinaria independiente | Si plan maestro | Si catalogo/soporte | Actualiza estados |
| Ver cobros | Propios si independiente | Si independiente | Plan maestro | Global | Genera recibos/estados |
| Ver auditoria | Limitado a eventos propios si se decide | Org/sede | Entidad | Global | Escribe |
| Config global | No | No | No | Si | Lee parametros |

## Datos visibles por rol

- Veterinario: pacientes y consultas de la cuenta donde atiende; agenda propia; vacunas de sus pacientes; notificaciones propias; plan solo si independiente.
- Admin Veterinaria: veterinarios de su clinica, pacientes/historias de la clinica, metricas de clinica, plan si independiente, notificaciones de clinica.
- Admin Entidad: veterinarias de la entidad, vets freelance vinculados, plan maestro, metricas consolidadas y por sede, brigadas, notificaciones de cadena.
- Super Admin: entidades, veterinarias, veterinarios, planes, cobros, metricas globales, logs de auditoria y configuracion global.
- Sistema: no ve por UI; actua con permisos server-side minimos y debe registrar auditoria cuando cambia estados o dispara avisos.

## Herencia de plan

Regla PDF: el veterinario vinculado hereda el plan; no paga individualmente. El repo actual calcula consumo por `orgId` si existe y por `vet_{uid}` si no existe. Esto es buena base, pero insuficiente para entidades con varias veterinarias.

Propuesta:

| Scope | `planOwnerType` | Consumo | Asientos | Pago |
|---|---|---|---|---|
| Vet independiente | `vet` | `vet_{uid}` | 1 | Vet |
| Veterinaria independiente | `veterinaria` | `vetclinica_{id}` | Plan clinica | Admin Veterinaria |
| Veterinaria bajo entidad | `entidad` heredado | Reporta a sede y entidad | Del pool master | Admin Entidad |
| Vet freelance entidad | `entidad` heredado | Reporta directo a entidad | Del pool master | Admin Entidad |

## Bloqueo por plan/suscripcion

Estados PDF: trial activo, activa, por vencer, vencida, bloqueada por mora. El repo agrega `bloqueado_fin_trial`, `desactivado`, `cancelada`, que son utiles si se documentan.

Cuando una cuenta esta bloqueada:

- Solo lectura: dashboard, pacientes, historias aprobadas, auditoria visible, plan/pago, perfil.
- Bloqueado: consulta nueva, procesar IA, aprobar, exportar PDF nuevo, crear/editar pacientes, crear citas, crear vacunas, invitar nuevos miembros.
- Permitido: pagar/reactivar, descargar recibos existentes, contactar soporte, cerrar sesion.

Decision pendiente: el PDF dice "cuenta bloqueada = vet en solo lectura (sin SOAP nuevos ni PDF)". Debe definirse si el bloqueo impide descargar PDFs historicos o solo generar/exportar nuevos.

## Acciones que nunca debe poder hacer cada rol

- Veterinario: no cambiar plan heredado, no ver datos de otras cuentas, no editar logs/auditoria, no configurar precios globales, no cambiar NIT de cuenta.
- Admin Veterinaria: no ver sedes hermanas, no cambiar plan maestro de entidad, no modificar datos personales del vet salvo activacion/desactivacion, no aprobar vinculos del area tecnica.
- Admin Entidad: no editar historias clinicas, no borrar pacientes de sedes sin regla explicita, no cambiar configuracion global ni planes/precios.
- Super Admin: no modificar contenido clinico sin evento de soporte auditado; no saltarse auditoria; no escribir secretos desde UI.
- Sistema: no actuar sin idempotencia; no escribir datos clinicos no derivados de eventos; no enviar avisos sin registrar fuente/evento.

## Casos delicados de seguridad

1. `Admin SDK` se salta Firestore rules; por eso toda API debe pasar por `assertAcceso` o equivalente V2.
2. Fallback legacy `veterinarioId == uid` es temporal; conservarlo indefinidamente reduce aislamiento tenant.
3. `functions/index.js` mantiene `generarNumeroHC` con contador global; si se usa junto a API puede romper consecutivos por institucion.
4. Frontend conserva Firestore directo con flags; las nuevas features no deben agregarse en ese camino.
5. Wompi debe validar firma y calcular monto server-side; el frontend actual de suscripcion esta desalineado con el DTO backend.
6. Storage debe permanecer tenant-scoped: `historiales/{orgId}/...`; no volver a rutas planas.
7. Invitaciones deben proteger correo existente y conflicto de plan mediante area tecnica, no vinculacion automatica ciega.

## Riesgo de convivencia API y `functions/` legacy

`firebase.json` despliega `functions/`; `functions/index.js` mantiene `generarNumeroHC` y `enviarHistorialEmail`; el frontend aun tiene flags legacy para HC/docs/IA/CRUD. Riesgos:

- Doble fuente de numeracion HC: API por tenant vs Function global.
- Doble canal de email: API con auditoria y rate limit vs Function legacy.
- Firestore directo puede permitir flujos no alineados con RBAC V2 si se agregan pantallas nuevas ahi.

Regla V2: las Cloud Functions quedan congeladas para compatibilidad. Todo alcance nuevo del PDF debe vivir en `/v1` y ser auditado.

## Reglas minimas para implementar RBAC V2

1. Escribir ADR de modelo jerarquico antes de cambiar claims.
2. Agregar tests negativos por nivel: entidad A no ve entidad B; sede A no ve sede B; vet freelance no ve sede; admin veterinaria no ve entidad completa.
3. Hacer backfill de `orgId`/`veterinariaId`/`entidadId` antes de activar UI.
4. Mantener feature flags de lectura pero impedir nuevas escrituras clinicas legacy.
5. Registrar auditoria para cambios de rol, scope, bloqueo, plan y vinculacion.
