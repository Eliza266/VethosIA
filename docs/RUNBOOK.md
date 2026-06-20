# RUNBOOK — levantar y operar VetIA

Guía práctica para correr todo en local, hacer la migración, desplegar a Cloud Run y salir de los
líos típicos. Los comandos son para **Windows / PowerShell** (usá `;` para encadenar, no `&&`).

> Pre-requisitos: Node 20, **Java JDK 21+** (Firebase CLI 15 exige Java 21 para emuladores),
> `firebase-tools` global (`npm i -g firebase-tools`), y opcional `gcloud` para deploy.
> Proyecto Firebase por defecto: `vethosia-production` (en `.firebaserc`). Prod desde cero: [VETHOSIA_PROD.md](./VETHOSIA_PROD.md).

---

## Prueba funcional REAL de IA (con tokens, sin emulador)

Verifica que las claves de los proveedores sirven de verdad (llamadas reales):

```powershell
cd api ; copy .env.example .env   # y pega tus claves ANTHROPIC/OPENAI/GEMINI
npx ts-node scripts/probe-ia.ts
```
Salida esperada por proveedor: `OK` / `CLAVE_INVALIDA` / `HTTP_xxx`. Resultado verificado
(2026-06): **Gemini OK**, **OpenAI STT OK**, **Anthropic = clave válida pero cuenta sin saldo**
(`credit balance too low`) → el pipeline SOAP cae automáticamente al fallback (Gemini). Para usar
Claude como primario, cargar crédito en Anthropic y poner `LLM_PROVIDER=anthropic`.

Smoke de la API (sin emulador; health es público):

```powershell
cd api ; npm run build ; node dist/main.js     # escucha en :8080
# en otra terminal:
Invoke-WebRequest http://localhost:8080/v1/health   # 200 {"status":"ok",...}
```

Integración IA real (opcional, gasta tokens): `cd api ; $env:RUN_LIVE_IA="1"; npm run test:integration`.

---

## TL;DR (todo en local con emuladores)

> **Java 21+ obligatorio** para Firebase CLI 15 (`firebase emulators:start`). Validar:
> `java -version` → debe mostrar `21` o superior.

```powershell
# 0) Seed usuario E2E (una vez, con emuladores arriba o antes del primer login)
cd api
copy .env.example .env          # IA_MOCK=true, emuladores, PORT=8081
npm run seed:e2e-local
# Credenciales: vet@vetia.local / VetIA-Local-2026!

# 1) Emuladores (terminal 1)
firebase emulators:start --only firestore,auth,storage --project vethosia-production
# UI: http://127.0.0.1:4000

# 2) API (terminal 2)
cd api
npm run start:dev               # http://127.0.0.1:8081/v1/health

# 3) Frontend (terminal 3)
cd frontend
copy .env.example .env.local    # ver bloque "Perfil local" en .env.example
# Flags locales típicos en .env.local:
#   VITE_USE_FIREBASE_EMULATORS=true
#   VITE_API_BASE_URL=http://127.0.0.1:8081
#   VITE_USE_API_IA=true
#   VITE_USE_API_HC=true
#   VITE_USE_API_DOCS=true   # PDF server-side
npm run dev -- --host 127.0.0.1 --port 5173
# App: http://127.0.0.1:5173
```

### Puertos locales

| Servicio | URL |
|----------|-----|
| Firebase Emulator UI | http://127.0.0.1:4000 |
| Firestore emulator | 127.0.0.1:8080 |
| Auth emulator | 127.0.0.1:9099 |
| Storage emulator | http://127.0.0.1:9199 |
| API health | http://127.0.0.1:8081/v1/health |
| Frontend | http://127.0.0.1:5173 |

### Flags locales (sin secrets)

| Variable | Valor dev | Efecto |
|----------|-----------|--------|
| `IA_MOCK` (api/.env) | `true` | STT + LLM mock en `/v1/ia/*` |
| `VITE_USE_API_IA` | `true` | Transcripción/SOAP vía API |
| `VITE_USE_API_HC` | `true` | Numeración HC vía `/v1/consultas/:id/hc` |
| `VITE_USE_API_DOCS` | `true` | PDF vía `POST /v1/consultas/:id/pdf` |
| `EMAIL_MOCK` (api/.env) | `true` | Email simulado en `POST /v1/consultas/:id/email` (sin SendGrid/SMTP) |

### Validación E2E automatizada

```powershell
cd api ; npm run e2e:runtime-smoke
cd frontend ; npx playwright test e2e/ia-mock-local.spec.ts
```

### Email mock en local

Con `EMAIL_MOCK=true` en `api/.env` (solo dev/test; **fail-closed en producción**):

- No se envían correos reales ni se requiere `SENDGRID_API_KEY` / `EMAIL_PASS`.
- `POST /v1/consultas/:id/email` responde `{ success: true, mock: true, messageId }`.
- La API registra en log: destinatario, paciente, vet y ruta resumida del PDF.
- Frontend: botón **Enviar por Email** en consulta aprobada (requiere `propietario.email` y `VITE_USE_API_DOCS=true`).

```powershell
# Smoke API (incluye email mock tras generar PDF)
cd api ; npm run e2e:runtime-smoke

# Playwright (flujo completo incluye email)
cd frontend ; npx playwright test e2e/ia-mock-local.spec.ts
```

### WhatsApp con PDF server-side en local

Sin enviar mensajes reales: el botón **Enviar WhatsApp** abre `wa.me` con texto prefilled.

Requisitos:

- Consulta **aprobada** + `VITE_USE_API_DOCS=true`
- Propietario con `telefono` o `whatsapp` (si falta, alerta amigable; no pantalla blanca)
- Código de país por defecto `57` si el número no trae `+` ni `codigoPais`

Flujo:

1. `POST /v1/consultas/:id/pdf` → URL proxy `/pdf/download` (emulador)
2. Mensaje incluye nombre propietario, paciente y link PDF
3. `window.open` → `https://wa.me/57XXXXXXXXXX?text=...`

```powershell
cd frontend ; npm run test:run -- sharing.test.ts
cd frontend ; npx playwright test e2e/ia-mock-local.spec.ts
```

---

## TL;DR legacy (puerto API 8080)

```powershell
# 1) Emuladores (terminal 1)
firebase emulators:start --project vethosia-production            # UI en http://localhost:4000

# 2) API (terminal 2)
cd api
copy .env.example .env
npm install
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; $env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"; $env:STORAGE_EMULATOR_HOST="http://127.0.0.1:9199"; $env:GCLOUD_PROJECT="vethosia-production"
npm run start:dev                                          # http://localhost:8080/v1/health

# 3) Frontend (terminal 3)
cd frontend
copy .env.example .env.local
npm install
npm run dev                                                # http://localhost:5173
```

---

## Emuladores de Firebase

`firebase.json` declara los emuladores: auth **9099**, firestore **8080**, storage **9199**,
functions **5001**, UI **4000**.

```powershell
firebase emulators:start --project vethosia-production
# o solo los que necesitás:
firebase emulators:start --only firestore,auth,storage --project vethosia-production
```

Para que `firebase-admin` (en la API y los scripts) hable con los emuladores en vez de la nube,
exportá **antes** de arrancar:

```powershell
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
$env:STORAGE_EMULATOR_HOST="http://127.0.0.1:9199"
$env:GCLOUD_PROJECT="vethosia-production"
```

---

## API (NestJS)

```powershell
cd api
copy .env.example .env      # completá GEMINI_API_KEY, email, etc.
npm install
npm run start:dev           # ts-node, http://localhost:8080/v1/health
```

Otros scripts útiles:

```powershell
npm run typecheck           # tsc --noEmit (estricto)
npm run lint                # eslint
npm run build               # compila a dist/
npm run start               # node dist/main.js (prod local)
```

---

## Frontend

```powershell
cd frontend
copy .env.example .env.local
npm install
npm run dev                 # http://localhost:5173
```

Otros scripts:

```powershell
npm run typecheck           # tsc -b
npm run build               # tsc -b ; vite build
npm run preview             # sirve el build
npm run lint                # eslint .
```

Para apuntar el front a la API local, dejá `VITE_API_BASE_URL=http://localhost:8080`. Para empezar
a usar la API de a poco, prendé un flag (ver [API.md](./API.md#feature-flags)):

```dotenv
VITE_USE_API_HC=true
```

---

## Migración multi-tenant

La migración es **idempotente** y **reversible**. Probala siempre primero contra el emulador.

```powershell
cd api
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; $env:GCLOUD_PROJECT="vethosia-production"
npm run seed:emulator        # datos de ejemplo (exige emulador; no corre contra prod)
npm run migrate              # crea org por defecto, miembros y backfillea orgId
npm run migrate -- --revert  # rollback: quita orgId, borra miembros migrados, limpia claims
```

Variables opcionales:

| Var | Default | Qué hace |
|---|---|---|
| `MIGRATION_ORG_ID` | `org-default` | id de la org por defecto |
| `MIGRATION_ORG_NOMBRE` | `Clinica VetIA (migrada)` | nombre de la org |

> Para correr contra **producción**, no setees `FIRESTORE_EMULATOR_HOST` y asegurate de tener las
> credenciales GCP correctas (`gcloud auth application-default login` o un service account). Hacé
> backup antes.

---

## Cloud Functions (legacy)

Las funciones viven en `functions/` (`generarNumeroHC`, `enviarHistorialEmail`). El email usa
secrets:

```powershell
cd functions
npm install
firebase functions:secrets:set EMAIL_PASS
firebase functions:secrets:set SENDGRID_API_KEY     # opcional; si no, cae a SMTP
firebase deploy --only functions
```

---

## Jobs Sistema Fase 1

El codigo de jobs internos queda disponible en `POST /v1/sistema/jobs/run`. Es un endpoint
`@Public()` protegido por el mismo `WorkerGuard` del worker IA: si `IA_WORKER_SECRET` esta seteado,
exige header `x-worker-secret`. No usa Firebase ID token de usuario.

Jobs incluidos:

- Vacunas: recalcula `al_dia` / `proxima_a_vencer` / `vencida`, genera notificaciones internas
  deduplicadas y prepara resumen semanal los lunes.
- Citas: recordatorio interno del dia anterior, alerta de proximas 2 horas y cierre a
  `no_asistio` solo para citas `programada` con mas de 24h vencidas.
- Consumo: notifica 80%, marca bloqueo al 100% y reinicia doc mensual el dia 1 cuando aplica.
- Suscripciones: `por_vencer` a 5 dias, `vencida` al corte y `bloqueada_mora` tras 5 dias de gracia.
- Invitaciones: expira invitaciones pendientes cuyo `exp` supera 48h.

Activacion sugerida en produccion (NO ejecutar desde este repo sin ventana de cambio):

```bash
# 1) Confirmar que Cloud Run tiene IA_WORKER_SECRET montado desde Secret Manager.
# 2) Crear un Cloud Scheduler HTTP POST diario contra:
#    https://<cloud-run-url>/v1/sistema/jobs/run
# 3) Agregar header x-worker-secret con el valor gestionado en Secret Manager.
# 4) Frecuencia sugerida: 06:00 America/Bogota todos los dias.
# 5) El mismo job diario genera el resumen semanal de vacunas solo cuando corresponde lunes.
```

No configurar WhatsApp/SMS para estos jobs en Fase 1; las salidas son notificaciones internas y
auditoria (`jobEventos` + `auditoria`).

---

## Deploy a Cloud Run (API)

> Pendiente de ejecutar en un entorno con credenciales GCP. Comandos listos:

```bash
gcloud run deploy vetia-api --source api --region us-central1 \
  --set-env-vars NODE_ENV=production,QUEUE_DRIVER=cloudtasks,IA_WORKER_URL=https://vetia-api-cwepwj6irq-uc.a.run.app/v1/ia/procesar \
  --set-secrets ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,IA_WORKER_SECRET=IA_WORKER_SECRET:latest,INVITE_SECRET=INVITE_SECRET:latest
```

Crear la cola de Cloud Tasks (solo una vez):

```bash
gcloud tasks queues create vetia-ia --location us-central1
```

Pasos recomendados:

1. Subí los secrets a Secret Manager (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `IA_WORKER_SECRET`, `INVITE_SECRET`; email solo si se habilita envio real).
2. Creá la cola `vetia-ia`.
3. `gcloud run deploy` con `QUEUE_DRIVER=cloudtasks` e `IA_WORKER_URL` apuntando a tu propia URL
   (`/v1/ia/procesar`).
4. Seteá `IA_WORKER_SECRET` (o configurá OIDC con `CLOUD_TASKS_INVOKER_SA`) para proteger el worker.
5. Seteá `INVITE_SECRET` fuerte (minimo 32 caracteres; recomendado 48+) y no uses el default dev.
6. Restringí `CORS_ORIGIN` al dominio real del frontend.
7. Apuntá el front (`VITE_API_BASE_URL`) a la URL de Cloud Run y prendé flags de a uno.

Artefactos locales como `vetia-api-run-config-backup-*.yaml` y `vetia-local-fixes.patch` estan
ignorados y no deben entrar a commit ni al ZIP de entrega.

---

## Variables de entorno (API)

De `api/src/common/config/env.schema.ts` y `main.ts`:

| Var | Default | Notas |
|---|---|---|
| `PORT` | `8080` | Cloud Run lo inyecta |
| `API_PREFIX` | `v1` | prefijo global |
| `CORS_ORIGIN` | (abierto) | CSV de orígenes; en prod restringí |
| `FIREBASE_PROJECT_ID` | `vethosia-production` | |
| `GCLOUD_PROJECT` | (cae a `FIREBASE_PROJECT_ID`) | |
| `STORAGE_BUCKET` | `vethosia-production.firebasestorage.app` | |
| `FIRESTORE_EMULATOR_HOST` | (vacío) | si está → usa emuladores |
| `FIREBASE_AUTH_EMULATOR_HOST` | (vacío) | |
| `STORAGE_EMULATOR_HOST` | `http://127.0.0.1:9199` | usado por storage en modo emulador |
| `GEMINI_API_KEY` | `''` | **requerida** para IA real |
| `GEMINI_MODEL` | `gemini-2.5-flash` | |
| `GEMINI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta` | |
| `SENDGRID_API_KEY` | (vacío) | si está → SendGrid; si no → SMTP |
| `EMAIL_FROM` | (cae a `EMAIL_USER`) | |
| `EMAIL_USER` | `vetiasoporte@gmail.com` | |
| `EMAIL_HOST` | (vacío) | si vacío → Gmail service |
| `EMAIL_PORT` | `587` | |
| `EMAIL_SECURE` | `false` | |
| `EMAIL_PASS` | (vacío) | |
| `EMAIL_RATE_LIMIT_MAX` | `5` | envíos por ventana por destinatario |
| `EMAIL_RATE_LIMIT_WINDOW_MS` | `60000` | ventana del rate limit |
| `QUEUE_DRIVER` | `inmemory` | `cloudtasks` para prod |
| `CLOUD_TASKS_LOCATION` | `us-central1` | |
| `CLOUD_TASKS_QUEUE` | `vetia-ia` | |
| `IA_WORKER_URL` | `''` | URL de `/v1/ia/procesar` |
| `CLOUD_TASKS_INVOKER_SA` | (vacío) | service account OIDC opcional |
| `IA_WORKER_SECRET` | (vacío) | si está → exige header `x-worker-secret` en el worker |
| `INVITE_SECRET` | dev/test default interno | obligatorio en `NODE_ENV=production`; min 32 chars, recomendado 48+ |

### Variables del frontend (`VITE_`)

| Var | Default | Notas |
|---|---|---|
| `VITE_FIREBASE_*` | — | config pública del cliente (no son secretos) |
| `VITE_API_BASE_URL` | `http://localhost:8080` | base de la API |
| `VITE_USE_API_HC` | `false` | flag Strangler |
| `VITE_USE_API_IA` | `false` | flag Strangler |
| `VITE_USE_API_DOCS` | `false` | flag Strangler (PDF + email) |
| `VITE_WHATSAPP_COUNTRY_CODE` | `57` | prefijo por defecto si el propietario no trae `codigoPais` |

> **La key de Gemini NO va en el frontend.** Vive solo server-side (`api/` y `functions/`).

### Secrets

| Secret | Dónde | Cómo |
|---|---|---|
| `GEMINI_API_KEY` | API (Cloud Run) | Secret Manager → `--set-secrets` |
| `ANTHROPIC_API_KEY` | API (Cloud Run) | Secret Manager → `--set-secrets` |
| `OPENAI_API_KEY` | API (Cloud Run) | Secret Manager → `--set-secrets` |
| `EMAIL_PASS` | API + Functions | `firebase functions:secrets:set EMAIL_PASS` / Secret Manager |
| `SENDGRID_API_KEY` | API + Functions (opcional) | íd. |
| `IA_WORKER_SECRET` | API | Secret Manager → `--set-secrets` |
| `INVITE_SECRET` | API | Secret Manager → `--set-secrets`; min 32 chars, recomendado 48+ |

---

## Troubleshooting

### El build del frontend falla por el binding nativo de rolldown (Vite 8)

Vite 8 usa **rolldown**, que trae un binding nativo por plataforma. Si el binding correcto no quedó
instalado (típico tras copiar `node_modules` entre máquinas/SO, o instalaciones interrumpidas), el
`vite build` revienta con un error de módulo nativo no encontrado.

**Arreglo:** reinstalá limpio para que baje el binario de tu plataforma.

```powershell
cd frontend
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json     # solo si sigue fallando
npm install
npm run build
```

### Disco lleno (instalaciones que fallan a mitad)

Síntomas: `npm install` o `playwright install` se cortan, errores `ENOSPC` o binarios incompletos
(ver el ítem de rolldown). Es lo que pasó al instalar los navegadores de Playwright.

**Arreglo:**

```powershell
npm cache clean --force
# liberá espacio y reintentá
cd frontend
npm install
```

### Navegadores de Playwright no instalados

Los e2e necesitan Chromium. Si nunca se instaló (por disco/red):

```powershell
cd frontend
npm run e2e:install      # playwright install
npm run e2e
```

### La API no se conecta a Firebase / pega a producción sin querer

Verificá las env de emulador **antes** de arrancar la API (`FIRESTORE_EMULATOR_HOST`, etc.). Si
están seteadas, `firebase-admin` usa los emuladores; si no, intenta ir a la nube (y necesita
credenciales).

### `401` en todos los endpoints

Falta el header `Authorization: Bearer <ID token>` o el token expiró. En el front lo agrega el
interceptor de `apiClient` automáticamente; si pegás a mano (curl/Postman), conseguí un ID token
válido del usuario logueado.

### `403` aunque el usuario está logueado

El recurso es de otro tenant/dueño (`assertAcceso`), o el endpoint pide rol `admin` y el usuario no
lo tiene. Revisá los custom claims del usuario (`GET /v1/organizaciones/me`).

### El seed se niega a correr

`seed-emulator.ts` **exige** `FIRESTORE_EMULATOR_HOST` para no tocar prod por accidente. Seteala.

---

> Relacionado: [TESTING](./TESTING.md) para correr las suites, [API](./API.md) para el contrato y
> [PASO-A-PASO](./PASO-A-PASO.md) para el contexto de qué se hizo.
