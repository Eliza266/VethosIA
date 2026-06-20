# VetIA API (NestJS)

API REST que monta una capa sobre Firebase siguiendo **Strangler Fig**: convive con la app
actual (Cloud Functions + acceso directo a Firestore desde el navegador) y va absorbiendo
responsabilidades sin romper nada. Base path del contrato: **`/v1`**. Pensada para **Cloud Run**.

## Contrato (endpoints)

| Método | Ruta | Qué hace | Auth |
|---|---|---|---|
| GET | `/v1/health` | `{ status: 'ok', time }` | público |
| POST | `/v1/consultas/:id/hc` | `{ numeroHC }` — numeración escalable **por clínica** | Bearer |
| POST | `/v1/ia/transcribir` | `{ transcripcion }` (Gemini, key server-side) | Bearer |
| POST | `/v1/ia/soap` | objeto SOAP (mismo shape que `generateSOAP` del front) | Bearer |
| POST | `/v1/consultas/:id/pdf` | `{ url }` (signed URL temporal) | Bearer |
| POST | `/v1/consultas/:id/email` | `{ success: true }` (proveedor real + rate limit) | Bearer |
| POST | `/v1/consultas/:id/procesar` | encola el pipeline async de IA (audioPath de Storage) | Bearer |
| POST | `/v1/ia/procesar` | worker que invoca Cloud Tasks / la cola in-memory | worker secret / OIDC |
| POST | `/v1/organizaciones` | crea org y deja al caller como `admin` | Bearer |
| POST | `/v1/organizaciones/:orgId/miembros` | alta de miembro + custom claims | Bearer (admin) |
| GET | `/v1/organizaciones/me` | membresía del usuario actual | Bearer |

**Auth:** header `Authorization: Bearer <Firebase ID token>`. El `AuthGuard` verifica el token
con `firebase-admin` y carga los custom claims `{ orgId, rol }` en `req.user`.

## Estructura

```
api/
  src/
    main.ts                      # bootstrap, prefijo /v1, ValidationPipe global
    app.module.ts                # guards globales (Auth + Roles) y wiring de módulos
    common/
      config/env.ts              # toda la config por env, tipada
      firebase/                  # FirebaseService (admin), collections, módulo global
      auth/                      # AuthGuard, RolesGuard, decoradores, access() (aislamiento tenant)
    modules/
      health/                    # GET /v1/health
      consultas/                 # hc.service (contador por clínica), pdf.service, controller
      ia/                        # gemini.service (tipado), ia.service, queue/ (in-memory + cloud tasks)
      email/                     # adaptador SendGrid/SMTP + rate limit
      storage/                   # signed URLs, lectura/escritura de objetos
      tenant/                    # organizaciones, miembros, custom claims
  scripts/                       # migrate.ts (idempotente + reversible), seed-emulator.ts
  test/                          # unit / integration (emulador) / rules (emulador)
  loadtest/hc.js                 # k6 (10k VUs contra /hc)
  Dockerfile                     # multi-stage para Cloud Run
```

## Correr en local

```powershell
cd api
copy .env.example .env     # completa GEMINI_API_KEY, email, etc.
npm install
npm run start:dev          # http://localhost:8080/v1/health
```

Para que `firebase-admin` hable con los **emuladores** en vez de la nube, exporta antes:

```powershell
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
$env:STORAGE_EMULATOR_HOST="http://127.0.0.1:9199"
$env:GCLOUD_PROJECT="vethosia-production"
```

## Scripts

```powershell
npm run typecheck          # tsc --noEmit (estricto, sin any)
npm run lint               # eslint (prohíbe 'any' en código nuevo)
npm run build              # compila a dist/
npm run test:unit          # tests de dominio (no necesitan emulador)
npm run test:rules         # tests de firestore.rules (necesitan emulador)
npm run test:integration   # tests contra Firestore emulador
```

## Migración multi-tenant

Ver `scripts/migrate.ts`. Idempotente y reversible:

```powershell
# probar contra el emulador (recomendado)
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; $env:GCLOUD_PROJECT="vethosia-production"
npm run seed:emulator       # datos de ejemplo
npm run migrate             # crea org por defecto, miembros y backfillea orgId
npm run migrate -- --revert # rollback (quita orgId, borra miembros migrados)
```

## Cola de IA asíncrona

- `QUEUE_DRIVER=inmemory` (default): procesa en background en el mismo proceso. Dev/test.
- `QUEUE_DRIVER=cloudtasks`: encola en Cloud Tasks que hace POST a `IA_WORKER_URL` (`/v1/ia/procesar`).
  Requiere crear la cola (`gcloud tasks queues create vetia-ia`) y permisos del service account.

## Desplegar a Cloud Run (pendiente de ejecutar en cloud)

```bash
gcloud run deploy vetia-api --source api --region us-central1 \
  --set-env-vars QUEUE_DRIVER=cloudtasks,IA_WORKER_URL=https://<url>/v1/ia/procesar \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest,EMAIL_PASS=EMAIL_PASS:latest
```
