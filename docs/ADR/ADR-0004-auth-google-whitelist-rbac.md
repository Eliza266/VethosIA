# ADR-0004: Autenticación con Google + whitelist y RBAC de 3 roles

- Estado: aceptada
- Fecha: 2026-06-14

## Contexto

El PDF de alcances (Fase 1, §3.7) pide email+contraseña, Google OAuth, verificación de email,
recuperación de contraseña e **invitación por enlace único de 48 h**, con tres roles
(Super Admin / Admin Entidad / Veterinario).

El repo actual ya implementa **Google sign-in** + una **whitelist fail-closed** de emails
(`configuracion/acceso.emailsPermitidos`) y un modelo de roles `admin | vet | asistente`.

## Decisión

Para el MVP mantenemos **Google sign-in + whitelist** como mecanismo de identidad y de control de
acceso, y montamos encima un **RBAC de 3 roles** (`superadmin | admin | vet`) vía custom claims
`{ orgId, rol }`. La "invitación" se implementa como:

1. El admin de la entidad agrega el email del veterinario a la whitelist y registra un **asiento**.
2. Al primer login con Google de ese email, el backend crea `miembros/{uid}` y setea los claims
   `{ orgId, rol: 'vet' }`.

No se implementa, en Fase 1, el flujo email+contraseña ni el enlace firmado de 48 h.

## Consecuencias

- **A favor:** menos superficie (sin gestión de contraseñas/reset), reutiliza la whitelist ya
  probada y el sign-in existente; entrega más rápida del MVP sin tocar el modelo de identidad.
- **En contra:** se desvía del PDF en el canal de invitación (enlace 48 h) y en email+contraseña.
  Queda como deuda explícita para Fase 2 si el negocio lo requiere.
- **Mitigación:** el límite de asientos del plan se valida igual en el alta de miembro; el RBAC y el
  aislamiento por tenant (`access.ts`) son idénticos a los que pedía el PDF.
