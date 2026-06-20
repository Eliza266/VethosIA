# Deploy y observabilidad (Vethosia)

> Proyecto prod: **`vethosia-production`** (GCP/Firebase nuevo). Checklist completo, variables y bootstrap:
> [VETHOSIA_PROD.md](./VETHOSIA_PROD.md). El ID `vetia-dd652` quedo obsoleto.

Estos comandos son runbook operativo; no significan que el RC actual ya haya sido desplegado.

## Entornos

| Entorno | Infra | Proyecto |
|---------|-------|----------|
| `dev` | Emuladores locales | `vethosia-production` (solo label; no toca nube) |
| `test` | CI + Firebase Emulator Suite | `vethosia-production` |
| `prod` | Cloud Run + Firebase Hosting | `vethosia-production` (GCP real) |

La seleccion de proveedores y secretos es por variable de entorno; nada hardcodeado en codigo.

## API a Cloud Run

Servicio Cloud Run canonico: **`vetia-api`**. El repositorio Artifact Registry puede llamarse
`vethosia-api`, pero no debe confundirse con el nombre del servicio.

```bash
cd api
SHA=$(git rev-parse --short HEAD)
IMAGE="us-central1-docker.pkg.dev/vethosia-production/vethosia-api/vetia-api:${SHA}"
gcloud builds submit --tag "${IMAGE}" --project vethosia-production
gcloud run deploy vetia-api \
  --image "${IMAGE}" \
  --region us-central1 \
  --project vethosia-production \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,LLM_PROVIDER=anthropic,STT_PROVIDER=openai,QUEUE_DRIVER=cloudtasks,CORS_ORIGIN=https://vethosia.com,https://www.vethosia.com,FIREBASE_PROJECT_ID=vethosia-production,GCLOUD_PROJECT=vethosia-production,STORAGE_BUCKET=vethosia-production.firebasestorage.app,IA_WORKER_URL=https://vetia-api-cwepwj6irq-uc.a.run.app/v1/ia/procesar \
  --set-secrets ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,IA_WORKER_SECRET=IA_WORKER_SECRET:latest,INVITE_SECRET=INVITE_SECRET:latest
```

- Secretos en **Secret Manager** (nunca `.env` plano en prod).
- `INVITE_SECRET` es obligatorio en `NODE_ENV=production`, minimo 32 caracteres y recomendado 48+.
- `CORS_ORIGIN` cerrado por defecto: si no se setea en prod, no se abre CORS a nadie.
- No montar `WOMPI_*` globales salvo compat legacy documentada; Wompi por cuenta se configura desde la app.
- URL temporal permitida de API: `https://vetia-api-cwepwj6irq-uc.a.run.app`.

## Cola IA (Cloud Tasks)

```bash
gcloud tasks queues create vetia-ia --location us-central1 --project vethosia-production
```

El `WorkerGuard` es **fail-closed**: en prod sin `IA_WORKER_SECRET` ni OIDC, rechaza (401).

## Frontend a Firebase Hosting

Build con `VITE_*` de prod (ver [VETHOSIA_PROD.md](./VETHOSIA_PROD.md)), luego:

```bash
cd frontend && npm run build
firebase deploy --only hosting --project vethosia-production
```

## Reglas e indices

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage --project vethosia-production
```

## Smoke test post-deploy

```bash
cd api && SMOKE_BASE_URL=https://vetia-api-cwepwj6irq-uc.a.run.app npm run smoke
```

## Observabilidad

- Logs estructurados de NestJS (`Logger`) a Cloud Logging.
- Health: `GET /v1/health` (liveness, `@Public`).
- Metricas: `GET /v1/metricas`. Auditoria: `GET /v1/auditoria`.

## Artefactos locales ignorados

- `vetia-api-run-config-backup-*.yaml` son respaldos locales de configuracion Cloud Run.
- `vetia-local-fixes.patch` es un parche local de trabajo.
- Ambos estan ignorados por Git y no deben entrar a commit ni a ZIP de entrega.

## Backups

- Firestore: exportaciones programadas (`gcloud firestore export gs://<bucket>-backups`) via Cloud Scheduler.
- Recuperacion: `gcloud firestore import gs://<bucket>-backups/<timestamp>`.
