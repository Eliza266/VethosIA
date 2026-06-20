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

```powershell
# requiere firebase-tools (npm i -g firebase-tools)
firebase emulators:start --project vethosia-production
# UI en http://localhost:4000
```

Para probar reglas/migración con datos:

```powershell
firebase emulators:start --only firestore,auth,storage --project vethosia-production
# en otra terminal:
cd api
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; $env:GCLOUD_PROJECT="vethosia-production"
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

## Qué NO se pudo ejecutar en este entorno

- **Desplegar a Cloud Run** y **crear la cola de Cloud Tasks**: requieren credenciales GCP. El código
  y los comandos quedan documentados.
- **k6 real (10k VUs)** y **tests de reglas/integración**: requieren k6 / los emuladores de Firebase
  (firebase-tools). Quedan listos y se ejecutan en CI (job `api-emulator`).
