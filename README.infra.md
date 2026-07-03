# VetIA — Backend e Infraestructura

Notas de la refactorización del backend/infra (frente backend). El frontend vive en
`frontend/` y lo lleva otro frente; acá documentamos **raíz**, **`functions/`** y la nueva **`api/`**.

## Mapa del repo

```
firebase.json            # declara firestore (rules+indexes), storage (rules), functions y EMULADORES
firestore.rules          # autorización por owner + tenant (orgId), con fallback legacy a veterinarioId
storage.rules            # audios/{uid}/** y historiales/** con límites de tamaño/content-type
firestore.indexes.json   # índices compuestos (consultas/pacientes/citas por vet y por orgId)
functions/               # Cloud Functions v1 (intactas en contrato; email migrado a secrets/adaptador)
api/                     # API NestJS (ver api/README.md)
.github/workflows/ci.yml # CI: api, api-emulator, functions, frontend
```

## Emuladores de Firebase

`firebase.json` declara los emuladores: **auth** (9099), **firestore** (8080), **storage** (9199),
**functions** (5001) y **UI** (4000).

> **Nota (2026-07-03):** en esta máquina el desarrollo local **no usa emuladores** (falta Java →
> error 503); se trabaja contra el proyecto real `vethosia-5895b` (ver Quickstart en `README.md`).
> Los comandos de abajo siguen siendo válidos para quien tenga Java instalado (p. ej. para probar
> reglas de Firestore con datos de prueba) y son los que usa el job `api-emulator` de CI.

```powershell
# requiere firebase-tools (npm i -g firebase-tools) y Java
firebase emulators:start --project vethosia-5895b
# UI en http://localhost:4000
```

Para probar reglas/migración con datos:

```powershell
firebase emulators:start --only firestore,auth,storage --project vethosia-5895b
# en otra terminal:
cd api
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; $env:GCLOUD_PROJECT="vethosia-5895b"
npm run seed:emulator
npm run migrate
```

## Modelo multi-tenant

- `organizaciones/{orgId}`: `{ nombre, plan, ciudad?, creadoEn }`
- `miembros/{uid}`: `{ orgId, rol: 'admin'|'vet'|'asistente', creadoEn }`
- Custom claims `{ orgId, rol }` seteados por la API (`TenantService`) al crear/asignar miembro.
- `pacientes/consultas/brigadas/citas` ganan `orgId` (se **mantiene** `veterinarioId` por compat).
- Aislamiento: un usuario sólo accede a docs de su `orgId` (reglas + chequeo server-side en la API).

## Seguridad de secretos

- **Gemini**: la key vive sólo server-side (`GEMINI_API_KEY` en `api/` y `functions/`). Se quitó del cliente.
- **Email**: ya no hay Gmail hardcodeado ni `functions.config()`. Se usa `defineSecret` (Functions)
  y un adaptador SendGrid/SMTP por env, tanto en `functions/` como en `api/`.

## Qué NO se pudo ejecutar en este entorno (nota histórica de la refactorización inicial)

> Esta sección es del momento en que se construyó la API sobre Firebase (antes de tener acceso a
> GCP). **Ya se resolvió:** hoy el deploy a Cloud Run y la cola de Cloud Tasks están funcionando
> en producción (`vethosia-5895b`) — ver `docs/VETHOSIA_PROD.md` y el documento maestro del
> negocio. Se deja como registro de cómo se construyó, no como pendiente actual.

- **Desplegar a Cloud Run** y **crear la cola de Cloud Tasks**: requerían credenciales GCP que no
  estaban disponibles en ese momento. El código y los comandos quedaron documentados.
- **k6 real (10k VUs)** y **tests de reglas/integración**: requieren k6 / los emuladores de Firebase
  (firebase-tools). Quedan listos y se ejecutan en CI (job `api-emulator`).
