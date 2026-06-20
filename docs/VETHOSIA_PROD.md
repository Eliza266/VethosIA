# Vethosia — proyecto de producción (desde cero)

Proyecto Firebase/GCP **nuevo** para producción. Marca visible de la app: **Vethos AI**.
El ID histórico `vetia-dd652` queda **obsoleto** (no se usa en deploy ni en nuevos entornos).

> Nota RC actual: este documento conserva evidencia historica/bootstrap de prod. No afirma que el
> release candidato local actual haya sido desplegado.

## ID de proyecto (activo)

**Project ID en uso:** `vethosia-production`  
**Storage bucket:** `vethosia-production.firebasestorage.app`  
**Web App:** `Vethosia Web` — config pública en `frontend/.env.example`.  
**Hosting default:** `https://vethosia-production.web.app`  
**Plan:** Blaze activo.

IDs alternativos (solo si hubiera que recrear el proyecto):

| Prioridad | Project ID | Notas |
|-----------|------------|--------|
| — | **`vethosia-production`** | **Actual** |
| 2 | `vethosia-app-prod` | Reserva |
| 3 | `vethosia-prod-2026` | Reserva con año |
| 4 | `vethosia-clinic-prod` | Reserva descriptiva |

El repo (`.firebaserc`, CI, defaults) apunta a `vethosia-production`.

## Local vs producción

| Aspecto | Local / CI (emuladores) | Producción |
|---------|-------------------------|------------|
| Proyecto Firebase | Mismo ID (`vethosia-production`) solo como **label** del emulador | Proyecto GCP real creado en consola |
| Credenciales cloud | **No** — `FIRESTORE_EMULATOR_HOST` etc. activos | ADC / service account Cloud Run |
| Datos | Emulador efímero o seed local | Firestore/Storage cloud |
| API keys IA/email | `IA_MOCK=true`, `EMAIL_MOCK=true` | Proveedores reales, mocks **prohibidos** |
| Cola IA | `QUEUE_DRIVER=inmemory` | `QUEUE_DRIVER=cloudtasks` |

Los emuladores **no requieren** que el proyecto exista en la nube; el ID solo debe ser
consistente en `.firebaserc`, CI y `GCLOUD_PROJECT` local.

---

## Checklist: crear cloud desde cero

Ejecutar en orden (una persona con permisos Owner en GCP). **No commitear secrets.**

### 1. Proyecto y billing

- [x] Crear proyecto GCP **`vethosia-production`**.
- [x] Vincular **billing account** (Blaze activo).
- [x] Project number: **306398232425** (Messaging sender ID coincide).

### 2. Firebase

- [x] Firebase vinculado al proyecto GCP.
- [x] **Web App** `Vethosia Web` → config en `frontend/.env.example`.
- [x] **Authentication** → Email/Password habilitado.
- [ ] **Authentication → Settings → Authorized domains** → `vethosia.com`, `www.vethosia.com`, localhost.
- [x] **Firestore** → `(default)`, Standard, `us-central1`.
- [x] **Storage** → bucket **`vethosia-production.firebasestorage.app`**.
- [x] **Hosting** → site `vethosia-production` (`vethosia-production.web.app`); deploy frontend pendiente.

### 3. Deploy reglas (sin datos de negocio aún)

**Estado: desplegado 2026-06-16** — reglas Firestore, índices compuestos (`citas`) y reglas Storage en prod.  
**2026-06-16 (fix fotos pacientes):** reglas `fotos-pacientes/{orgId}/{pacienteId}/**` + legacy `fotos-pacientes/{uid}/{pacienteId}`; frontend sube a ruta org-scoped.

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project vethosia-production
```

### 4. Cloud Run (API)

- [x] Habilitar APIs: Cloud Run, Artifact Registry, Cloud Build, Secret Manager, Cloud Tasks, IAM Credentials (**2026-06-16**).
- [x] Artifact Registry repo **`vethosia-api`** (Docker, `us-central1`).
- [x] Build imagen → `us-central1-docker.pkg.dev/vethosia-production/vethosia-api/vetia-api:latest` (**2026-06-16**).
- [x] Deploy servicio Cloud Run **`vetia-api`**, región `us-central1`, rev **`vetia-api-00011-9pt`** (**2026-06-16**, integración final: vacunas CRUD, PDF premium, RBAC DELETE).
- [x] Service account **`vetia-api-sa`**: Firestore, Firebase Auth, Storage, Cloud Tasks Enqueuer, Secret Accessor.
- [x] IAM signed URL (**2026-06-16**): `vetia-api-sa` → `roles/iam.serviceAccountTokenCreator` sobre sí misma (`signBlob` para PDF).
- [x] Invocación HTTP pública vía **`--no-invoker-iam-check`** (**2026-06-16**) — org policy bloquea `allUsers`; auth en app (Firebase Bearer).
- [ ] Domain mapping: `api.vethosia.com` (registros DNS desde consola).

**URL temporal:** `https://vetia-api-cwepwj6irq-uc.a.run.app`
**Health:** `GET /v1/health` → `{ "status": "ok" }` (público, sin token)  
**Acceso HTTP:** Cloud Run con `--no-invoker-iam-check` (sin binding `allUsers`). Endpoints de negocio exigen `Authorization: Bearer <Firebase ID token>` (`AuthGuard` global).

```bash
gcloud run services update vetia-api --region=us-central1 --project=vethosia-production --no-invoker-iam-check
```

### 5. Cloud Tasks

**Estado: creada 2026-06-16** — cola `vetia-ia` en `us-central1` (RUNNING).

```bash
gcloud tasks queues create vetia-ia --location=us-central1 --project=vethosia-production
```

(Nombre alineado con `CLOUD_TASKS_QUEUE` en la API.)

### 6. Secret Manager

**Estado: 2026-06-16** — secrets mínimos para API Gemini cargados y montados en Cloud Run.

| Secret | Uso | Versión |
|--------|-----|---------|
| `GEMINI_API_KEY` | Fallback / live tests | v1 **enabled** → montado en Run |
| `IA_WORKER_SECRET` | Header worker `/v1/ia/procesar` | v2 **enabled** → montado en Run |
| `OPENAI_API_KEY` | STT prod cuando `STT_PROVIDER=openai` | v1 **enabled** → montado en Run |
| `ANTHROPIC_API_KEY` | LLM prod cuando `LLM_PROVIDER=anthropic` | v1 **enabled** → montado en Run |
| `EMAIL_PASS` | SMTP | pendiente |
| `SENDGRID_API_KEY` | Email opcional | pendiente |
| `WOMPI_PRIVATE_KEY` | Pagos | pendiente |
| `WOMPI_EVENTS_SECRET` | Webhook Wompi | pendiente |
| `INVITE_SECRET` | Tokens de invitación; requerido en `NODE_ENV=production`, min 32 chars, recomendado 48+ | requerido |

### 7. Frontend Hosting

- [x] Build con variables `VITE_*` de prod (**2026-06-16**, env en shell; no commitear `.env*`).
- [x] `firebase deploy --only hosting --project vethosia-production` (**2026-06-16**, integración final + branding **Vethos AI**)
- [x] Fix descarga PDF (**2026-06-16**): frontend usa `POST /pdf` + `GET /pdf/download` (proxy API); no `fetch` cross-origin a GCS (bucket sin CORS).
- [ ] Custom domains: `vethosia.com`, `www.vethosia.com` (DNS según consola Firebase).

**URLs activas:** `https://vethosia-production.web.app`, `https://vethosia-production.firebaseapp.com`  
**API temporal en build:** `https://vetia-api-cwepwj6irq-uc.a.run.app`
**Smoke:** index 200, bundle incluye Cloud Run URL, sin `localhost` en assets.

### 8. Smoke tests

- [x] API health público (`GET /v1/health`)
- [x] Frontend Hosting carga (`vethosia-production.web.app`)
- [x] Bootstrap org/admin (**2026-06-16**)
- [x] Login app + `GET /v1/me` con Bearer (**2026-06-16** bootstrap)
- [x] Flujo clínico / IA + PDF (**2026-06-16**; IAM signBlob + proxy download)
- [x] Agenda vinculada a consulta (**2026-06-16**; API `vetia-api-00006-qdq` + hosting commit `63630bb`; smoke manual pendiente)
- [x] Fotos de paciente: Storage org-scoped + PATCH `/v1/pacientes/:id` persiste `foto` (**2026-06-16**)
- [x] Vacunas CRUD + DELETE solo admin/vet (**2026-06-16** integración)
- [x] PDF premium server-side + branding **Vethos AI** (**2026-06-16**); PDFs antiguos en Storage requieren re-export manual
- [x] Branding UI **Vethos AI** (navbar, login, PWA, PDF footers)
- [ ] WhatsApp / email con PDF en prod

```bash
cd api && SMOKE_BASE_URL=https://vetia-api-cwepwj6irq-uc.a.run.app npm run smoke
```

---

## Variables de producción

### API (Cloud Run — env)

```env
NODE_ENV=production
API_PREFIX=v1
PORT=8080
CORS_ORIGIN=https://vethosia.com,https://www.vethosia.com

FIREBASE_PROJECT_ID=vethosia-production
GCLOUD_PROJECT=vethosia-production
STORAGE_BUCKET=vethosia-production.firebasestorage.app

IA_MOCK=false
EMAIL_MOCK=false
STT_PROVIDER=openai
LLM_PROVIDER=anthropic
QUEUE_DRIVER=cloudtasks
CLOUD_TASKS_LOCATION=us-central1
CLOUD_TASKS_QUEUE=vetia-ia
IA_WORKER_URL=https://vetia-api-cwepwj6irq-uc.a.run.app/v1/ia/procesar
CLOUD_TASKS_INVOKER_SA=vetia-api-sa@vethosia-production.iam.gserviceaccount.com
CORS_ORIGIN=https://vethosia.com,https://www.vethosia.com,https://vethosia-production.web.app,https://vethosia-production.firebaseapp.com

WOMPI_BASE_URL=https://sandbox.wompi.co/v1
SESSION_INACTIVITY_HOURS=8
EMAIL_FROM=<email-operaciones@dominio>
```

**No setear** `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `STORAGE_EMULATOR_HOST`.

Secrets montados en Cloud Run (GSM `:latest`):

```text
GEMINI_API_KEY=GEMINI_API_KEY:latest
IA_WORKER_SECRET=IA_WORKER_SECRET:latest
OPENAI_API_KEY=OPENAI_API_KEY:latest
ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest
INVITE_SECRET=INVITE_SECRET:latest
```

**Nota IA (2026-06-16):** el smoke falló con `413 PayloadTooLarge` en `POST /v1/ia/transcribir` porque el frontend envía `audioBase64` inline. La API acepta JSON hasta **50mb** (`api/src/main.ts`). Mejora futura: pasar `audioPath` desde el frontend tras subir a Storage.

### Frontend (build-time `VITE_*`)

**Config productiva esperada:** `VITE_API_BASE_URL` apunta a Cloud Run directo. El verificador de build solo permite `https://vetia-api-cwepwj6irq-uc.a.run.app`; si cambia el dominio productivo, actualizar primero `frontend/scripts/verify-prod-build.mjs`.

```env
VITE_FIREBASE_API_KEY=<FIREBASE_WEB_API_KEY_FROM_CI>
VITE_FIREBASE_AUTH_DOMAIN=vethosia-production.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=vethosia-production
VITE_FIREBASE_STORAGE_BUCKET=vethosia-production.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=306398232425
VITE_FIREBASE_APP_ID=1:306398232425:web:3d5edaa1dda496e4f2c7f8
VITE_FIREBASE_MEASUREMENT_ID=G-620ZZP7F69

VITE_USE_FIREBASE_EMULATORS=false
VITE_API_BASE_URL=https://vetia-api-cwepwj6irq-uc.a.run.app
VITE_USE_API_HC=true
VITE_USE_API_IA=true
VITE_USE_API_DOCS=true
VITE_USE_API_CRUD=true
VITE_WHATSAPP_COUNTRY_CODE=57
```

Tras verificar dominio custom, `VITE_FIREBASE_AUTH_DOMAIN` puede pasar a `vethosia.com`.

---

## Bootstrap: primer admin / organización

**Estado: completado 2026-06-16**

| Campo | Valor |
|-------|--------|
| Usuario | `gerencia@nextvoiceia.com` |
| Org ID | `GT1BZbIdWWS7fANv3EUW` |
| Nombre | Vethosia |
| Plan | `free` |
| Ciudad | Colombia |
| Rol | `admin` |

Tras Auth + API desplegada, el primer usuario debe tener una org con custom claims `{ orgId, rol: 'admin' }`.

**Endpoint canónico:** `POST /v1/organizaciones` (Bearer Firebase ID token).  
Implementación: `TenantController.crear` → `TenantService.crearOrganizacion`.

DTO (`CrearOrgDto`): `nombre` (requerido, min 2), `plan?` (`free`|`pro`|`enterprise`, default `free`), `ciudad?`.  
Respuesta: `{ "orgId": "..." }`. Sin rol en body: el caller queda `admin`. Rechaza 409 si ya pertenece a una org.

### Bootstrap ejecutado

Se aplicó la misma lógica que el endpoint (org + miembro + custom claims) vía **Admin SDK** porque la org policy GCP bloquea `signBlob`/custom token local y el ID token por password no estaba disponible en la sesión automatizada.

Para bootstrap HTTP manual (futuros entornos):

```bash
# signInWithPassword → ID token → NO commitear tokens
curl -sS -X POST "<API_BASE>/v1/organizaciones" \
  -H "Authorization: Bearer <ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Vethosia","plan":"free","ciudad":"Colombia"}'
```

4. **Refrescar token** en el cliente (`getIdToken(true)`) para que los claims `{ orgId, rol }` lleguen al front y a las reglas Firestore. Sin relogin, el navbar puede mostrar rol viejo tras cambio de claims.
5. Verificar: `GET /v1/organizaciones/me` y `GET /v1/me`.

### Roles en UI

| Claim | Label navbar | Entidad visible | DELETE vacunas |
|-------|--------------|-----------------|----------------|
| `admin` | Admin Entidad | Sí | Sí |
| `vet` | Veterinario | No | Sí |
| `asistente` | (según perfil) | No | No (403 API) |
| `superadmin` | Super Admin | Según módulo | Según endpoint |

### PDF en Storage

Los PDF ya generados en `historiales/{orgId}/...` **no se actualizan solos** al cambiar plantilla o branding. Para ver diseño premium / Vethos AI: abrir consulta **aprobada** → Descargar PDF (regenera vía API).

### Whitelist de acceso (opcional)

Doc Firestore `configuracion/acceso`:

```json
{ "emailsPermitidos": [] }
```

Lista vacía = acceso abierto. Lista con emails = fail-closed server-side en `GET /v1/me`.

### Invitar más miembros

`POST /v1/organizaciones/:orgId/miembros` (requiere rol `admin`).

---

## DNS (resumen)

Valores exactos salen al agregar dominios en Firebase Hosting y Cloud Run.

| Host | Destino |
|------|---------|
| `vethosia.com` | Firebase Hosting (A o CNAME según consola) |
| `www.vethosia.com` | Firebase Hosting (CNAME típico) |
| `api.vethosia.com` | Cloud Run domain mapping |
| TXT | Verificación Firebase / Google SSL |

SSL gestionado por Google; puede tardar 24–48 h tras DNS correcto.

---

## Migración desde `vetia-dd652`

No aplica si prod es **base limpia**. Si hubiera datos legacy en el proyecto viejo, usar
`api/scripts/migrate.ts` solo contra el proyecto origen (con backup), no incluido en este flujo.
