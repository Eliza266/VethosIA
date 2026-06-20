# Deploy productivo RBAC clinico 1441646

Fecha operativa: 2026-06-17 19:58 -05:00

## Resumen

Se completo el deploy controlado del fix RBAC clinico del commit `14416469a257b72db763567cf359d9c2835b8089`.

El cambio restringe rutas y acciones clinicas por rol, manteniendo compatibilidad legacy y sin ejecutar migraciones, backfill ni cambios manuales de usuarios/claims.

## Version desplegada

- Commit: `14416469a257b72db763567cf359d9c2835b8089`
- Commit corto: `1441646`
- Mensaje: `fix(rbac): restrict clinical routes and actions by role`
- API Cloud Run: `vetia-api`
- Region: `us-central1`
- Revision API: `vetia-api-00032-jeg`
- Tag revision: `rbac-clinical-1441646`
- Trafico API: 100%
- Rollback API: `vetia-api-00030-lab`
- Imagen API: `us-central1-docker.pkg.dev/vethosia-production/vethosia-api/vetia-api:1441646`
- Digest API: `sha256:c3c19ab0a9530c6aca785d2297a44b2afc1faebc78c6932c371de34c3588834d`
- API URL: `https://vetia-api-cwepwj6irq-uc.a.run.app`
- Hosting URL: `https://vethosia-production.web.app`

## Tests ejecutados

API:

- `cd api && npm run build`: OK.
- `cd api && npm run test:unit -- access --runInBand`: OK.
- `cd api && npm run test:unit -- guards pacientes consultas citas brigadas --runInBand`: OK.
- Resultado observado: 38 suites / 368 tests OK.

Frontend:

- `cd frontend && npm run typecheck`: OK.
- `cd frontend && npm run test:run -- rbac Navbar RoleRoute ClinicalRoute Dashboard AdminVeterinaria Suscripcion SubscriptionRoute ConsultaActions tenant vacunas`: OK.
- Resultado observado: 14 files / 89 tests OK.
- `cd frontend && $env:VITE_API_BASE_URL='https://vetia-api-cwepwj6irq-uc.a.run.app'; npm run build`: OK.
- `git diff --check`: OK.

## Smoke API

Tagged API:

- `https://rbac-clinical-1441646---vetia-api-cwepwj6irq-uc.a.run.app/v1/health`: 200.
- `/v1/me` con `admin.veterinaria@vethosia.com`: 200.
- `/v1/me` con `gerencia@vethosia.com`: 200.
- `/v1/me` con `veterinario@vethosia.com`: 200.
- `/v1/me` con `superadmin@vethosia.com`: 200.

Validacion de `admin.veterinaria@vethosia.com`:

- `role`: `admin_veterinaria`
- `rol`: `admin`
- `orgId`: `iVQURlMlESO5af6hbQ8I`
- `entidadId`: `ent_iVQURlMl`
- `veterinariaId`: `vetclin_iVQURlMl`
- `accountId`: `vetclin_iVQURlMl`
- `accountType`: `veterinaria`
- `planOwnerType`: `entidad`
- `planOwnerId`: `ent_iVQURlMl`
- `membershipId`: `m_97c818b1_iVQURlMl`
- No se degrada a `admin_entidad`.

API principal despues de promocion:

- `https://vetia-api-cwepwj6irq-uc.a.run.app/v1/health`: 200.

## Smoke web por rol

Hosting desplegado:

- `firebase deploy --only hosting --project vethosia-production`: OK.
- `https://vethosia-production.web.app`: 200.
- `https://vethosia-production.web.app/manifest.webmanifest`: 200.
- Bundle vivo contiene `vetia-api-cwepwj6irq-uc.a.run.app`.
- Bundle vivo no contiene `vetia-api-306398232425.us-central1.run.app`.

Roles validados:

- `admin.veterinaria@vethosia.com`:
  - Login OK.
  - `/veterinaria` OK.
  - `/entidad` redirige o bloquea fuera de Vista Entidad.
  - `/admin` redirige o bloquea fuera de plataforma.
  - `/pacientes`, `/agenda`, `/brigadas` permiten empty state o datos de su veterinaria.
  - `/suscripcion` queda en solo lectura porque `planOwnerType=entidad`.
  - No se observo boton de pago Wompi ni checkout editable.

- `gerencia@vethosia.com`:
  - Login OK.
  - `/entidad` OK.
  - `/suscripcion` OK.
  - Rutas clinicas directas `/pacientes`, `/agenda`, `/brigadas` redirigen a `/entidad` segun RBAC nuevo.
  - `/admin` redirige o bloquea fuera de plataforma.

- `veterinario@vethosia.com`:
  - Login OK.
  - `/pacientes`, `/agenda`, `/brigadas` OK para flujo clinico.
  - `/suscripcion` redirige o bloquea.
  - No se observo acceso a gestion de suscripcion.

- `superadmin@vethosia.com`:
  - Login OK.
  - `/admin` OK.
  - `/pacientes`, `/agenda`, `/brigadas` redirigen a `/admin`.
  - `/suscripcion` redirige o bloquea.

## Confirmaciones de alcance

- No se crearon usuarios.
- No se desactivaron usuarios.
- No se cambiaron claims.
- No se escribio Firestore produccion.
- No hubo migracion real.
- No hubo backfill real.
- No se tocaron `.env`.
- No se tocaron `api/scripts/ops/`.
- No se aplico ni borro stash ops.
- No se imprimieron tokens ni secretos.

## Riesgos restantes

- `admin.veterinaria@vethosia.com` es valido para smoke del rol, pero la data clinica bajo `veterinariaId=vetclin_iVQURlMl` esta vacia por ahora.
- Sigue la convivencia entre scopes V2 y `orgId` legacy; el fallback legacy continua activo.
- Backfill V2 de data clinica sigue pendiente y debe ejecutarse solo con plan controlado.
- Push a GitHub sigue pendiente; este deploy fue local/controlado sin push.

## Rollback

Rollback API:

- Revision anterior: `vetia-api-00030-lab`.
- Accion esperada si aparece regresion: mover 100% del trafico de `vetia-api` a `vetia-api-00030-lab`.

Rollback Hosting:

- Usar rollback de Firebase Hosting a la version previa desde consola o CLI si aparece regresion visual o de rutas.

No revertir indices Firestore ni ejecutar backfill inverso; este deploy no corrio migraciones ni escrituras de datos.
