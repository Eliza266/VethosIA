# ADR-0005: Autenticación ampliada (email+password, Google, invitación 48h) — supersede ADR-0004

- Estado: aceptada
- Fecha: 2026-06-14
- Supersede: ADR-0004 (que limitaba el MVP a Google + whitelist)

## Contexto

El PDF de alcances (sección 07.A) especifica explícitamente para Fase 1: email + contraseña,
Google OAuth 2.0, recuperación de contraseña, verificación de email e **invitación por enlace
único (48 horas)**. ADR-0004 había acotado el MVP a Google-only por velocidad, pero el cliente
pidió cumplir el PDF completo.

> Nota: la sección 01.B del PDF lista "Autenticación y onboarding" bajo "Expansión Futura",
> en aparente contradicción con 07.A que la detalla. Resolvemos a favor de la sección detallada
> (07.A) e implementamos auth completa en Fase 1.

## Decisión

1. **Identidad** (frontend, Firebase Auth client): email+password + Google OAuth + recuperación
   de contraseña (`sendPasswordResetEmail`) + verificación de email (`sendEmailVerification`).
2. **Invitación por enlace único 48h** (backend): `InvitacionesService` emite un token HMAC
   autocontenido `base64url(payload).firma` con `exp = now + 48h`. `POST /v1/invitaciones`
   (solo admin, valida asientos del plan) lo crea; `POST /v1/invitaciones/aceptar` valida firma
   y expiración, crea `miembros/{uid}` + custom claims y notifica al admin (`invitacion_aceptada`).
3. **Bloqueo de cuenta**: `PATCH /v1/organizaciones/:orgId/miembros/:uid/bloqueo` marca el
   miembro y deshabilita el usuario en Firebase Auth.
4. La **whitelist** de ADR-0004 se mantiene como barrera adicional opcional, no como único
   mecanismo.

## Consecuencias

- A favor: cumple el PDF; onboarding self-service por entidad con control de asientos.
- En contra: más superficie de auth (reset/verificación) que vive en el cliente (Firebase Auth).
- Seguridad: el token de invitación es firmado (HMAC `INVITE_SECRET`), con expiración y
  comparación en tiempo constante; no se persiste estado.
