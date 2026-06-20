# Final Deploy Checklist - Vethos AI

Objetivo: operar y validar de forma controlada un release candidato, sin migraciones reales, sin retirar legacy y con rollback claro.

Nota RC actual: este documento prepara un deploy futuro; no afirma que el estado actual del worktree haya sido desplegado.

Referencia historica de release desplegado anterior: `c06d908818f31db8ad85e310ceab494a68a94484`.

API produccion conocida: Cloud Run `vetia-api` / URL temporal permitida `https://vetia-api-cwepwj6irq-uc.a.run.app`.

Frontend produccion historico: Firebase Hosting fue verificado contra `https://vetia-api-cwepwj6irq-uc.a.run.app`. Revalidar bundle vivo antes de cualquier deploy nuevo.

Roles humanos canonicos V2: `superadmin`, `admin_entidad`, `admin_veterinaria`, `veterinario`. `asistente` queda legacy/deprecated y `sistema` queda como actor interno server-side, no usuario Auth ni rol asignable.

Gate Admin Veterinaria: no crear `admin.veterinaria@vethosia.com` en Auth ni asignar claims reales hasta que exista `veterinarias/{veterinariaId}` productivo, membership V2 completo, smokes de `/v1/me` y aislamiento por veterinaria. El soporte local es aditivo, pero produccion sigue principalmente en `orgId` legacy.

## 0. Preflight

Ejecutar desde la raiz del repo:

```powershell
git status --short
git rev-parse HEAD
git log --oneline -8
git stash list
git ls-tree -r --name-only HEAD | Select-String -Pattern '(^|/)(\.env$|node_modules/|dist/|build/|api-boot\.log$|api-run\.log$|api/scripts/ops/)'
```

Condiciones:

- `git status --short` limpio.
- `HEAD` igual a `c06d908818f31db8ad85e310ceab494a68a94484`, o a un commit posterior aprobado explicitamente para docs/postdeploy.
- `git stash list` conserva `wip ops scripts not part of delivery`; no aplicar ni borrar.
- El comando de basura no debe listar `.env`, `node_modules/`, `dist/`, `build/`, logs locales ni `api/scripts/ops/`.
- Confirmar que no se crearon usuarios/claims nuevos para `admin.veterinaria@vethosia.com` antes del backfill de scope V2.
- `vetia-api-run-config-backup-*.yaml` y `vetia-local-fixes.patch` son artefactos locales ignorados; no deben entrar a commit ni al ZIP de entrega.

Validar proyecto:

```powershell
firebase use prod
gcloud config set project vethosia-production
gcloud auth list
```

Validar secretos antes de deploy:

```powershell
gcloud secrets versions access latest --secret=ANTHROPIC_API_KEY --project=vethosia-production --out-file=NUL
gcloud secrets versions access latest --secret=OPENAI_API_KEY --project=vethosia-production --out-file=NUL
gcloud secrets versions access latest --secret=GEMINI_API_KEY --project=vethosia-production --out-file=NUL
gcloud secrets versions access latest --secret=IA_WORKER_SECRET --project=vethosia-production --out-file=NUL
gcloud secrets versions access latest --secret=INVITE_SECRET --project=vethosia-production --out-file=NUL
```

`INVITE_SECRET` es obligatorio para `NODE_ENV=production`, minimo 32 caracteres y recomendado 48+; no usar el default de desarrollo.

Wompi ya no es obligatorio a nivel global para arrancar la API. Los secretos Wompi se configuran por cuenta (`planOwner`) desde la app y se almacenan en Secret Manager con nombres derivados del `planOwnerId`. El deploy no debe bloquearse si faltan `WOMPI_*` globales; el checkout permanece deshabilitado hasta que cada cuenta configure su proveedor.

Opcional (solo compat legacy o cuentas ya migradas manualmente):

```powershell
gcloud secrets versions access latest --secret=WOMPI_EVENTS_SECRET --project=vethosia-production --out-file=NUL
gcloud secrets versions access latest --secret=WOMPI_PRIVATE_KEY --project=vethosia-production --out-file=NUL
gcloud secrets versions access latest --secret=WOMPI_PUBLIC_KEY --project=vethosia-production --out-file=NUL
gcloud secrets versions access latest --secret=WOMPI_INTEGRITY_SECRET --project=vethosia-production --out-file=NUL
```

Validar IAM de Secret Manager para la service account runtime de Cloud Run. Si la API usa una service account custom, completar `$RUN_SA` con ese correo; si usa la default, resolverla desde el numero de proyecto:

```powershell
$RUN_SA = gcloud run services describe vetia-api --region us-central1 --project vethosia-production --format="value(spec.template.spec.serviceAccountName)"
if (-not $RUN_SA) {
  $PROJECT_NUMBER = gcloud projects describe vethosia-production --format="value(projectNumber)"
  $RUN_SA = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
}
gcloud projects get-iam-policy vethosia-production `
  --flatten="bindings[].members" `
  --filter="bindings.members:serviceAccount:$RUN_SA AND bindings.role:roles/secretmanager.admin" `
  --format="table(bindings.role,bindings.members)"
```

Gate: debe existir un rol que permita como minimo `secretmanager.secrets.create`, `secretmanager.secrets.get`, `secretmanager.versions.add` y `secretmanager.versions.access`. Para F1 se acepta `roles/secretmanager.admin` acotado al proyecto; en hardening posterior reemplazar por un rol custom de menor privilegio.

Backup recomendado antes de cambios:

```powershell
gcloud firestore export gs://vethosia-production-backups/predeploy-$(Get-Date -Format yyyyMMdd-HHmmss) --project=vethosia-production
```

## 1. Verificacion Local Final

API:

```powershell
cd api
npm run build
npm run test:unit -- access --runInBand
cd ..
```

Frontend:

```powershell
cd frontend
npm run typecheck
npm run build
npm run test:run -- rbac Navbar RoleRoute Dashboard
npm run test:run -- consultas pacientes vacunas DetallePaciente DetalleConsulta
npm run test:run -- saas Dashboard Suscripcion metricas notificaciones rbac
npm run test:run -- tenant
npm run e2e -- smoke.spec.ts ia-mock-local.spec.ts roles-principales.spec.ts --workers=1
cd ..
```

## 2. Deploy De Indices Firestore

Desplegar primero indices, sin rules ni hosting:

```powershell
firebase deploy --only firestore:indexes --project vethosia-production
```

Esperar a que los indices requeridos queden listos:

```powershell
gcloud firestore indexes composite list --database="(default)" --project=vethosia-production
```

Validar que existan los compuestos de `consultas`:

- `accountId ASC, fechaHora DESC`
- `accountId ASC, pacienteId ASC, fechaHora DESC`
- `entidadId ASC, fechaHora DESC`
- `entidadId ASC, pacienteId ASC, fechaHora DESC`
- `veterinariaId ASC, fechaHora DESC`
- `veterinariaId ASC, pacienteId ASC, fechaHora DESC`

No promover API hasta que los indices necesarios esten `READY`.

## 3. Deploy API Sin Trafico

Construir imagen desde `api/` porque el Dockerfile esta en `api/Dockerfile`:

```powershell
$SHA = git rev-parse --short HEAD
$IMAGE = "us-central1-docker.pkg.dev/vethosia-production/vethosia-api/vetia-api:$SHA"
gcloud builds submit api --tag "$IMAGE" --project vethosia-production
```

Desplegar revision Cloud Run sin trafico. Usar delimitador alterno en `--set-env-vars` porque `CORS_ORIGIN` contiene coma:

```powershell
$SHA = git rev-parse --short HEAD
gcloud run deploy vetia-api `
  --image "$IMAGE" `
  --region us-central1 `
  --project vethosia-production `
  --allow-unauthenticated `
  --no-traffic `
  --set-env-vars "^|^NODE_ENV=production|LLM_PROVIDER=anthropic|STT_PROVIDER=openai|QUEUE_DRIVER=cloudtasks|CORS_ORIGIN=https://vethosia.com,https://www.vethosia.com|FIREBASE_PROJECT_ID=vethosia-production|GCLOUD_PROJECT=vethosia-production|STORAGE_BUCKET=vethosia-production.firebasestorage.app|IA_WORKER_URL=https://vetia-api-cwepwj6irq-uc.a.run.app/v1/ia/procesar" `
  --set-secrets ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,IA_WORKER_SECRET=IA_WORKER_SECRET:latest,INVITE_SECRET=INVITE_SECRET:latest
```

Nota: no montar `WOMPI_*` globales en Cloud Run salvo compat legacy. Cada cuenta configura Wompi desde `/v1/pagos/config/wompi`.

Obtener URL de la nueva revision y probarla directamente:

```powershell
gcloud run revisions list --service vetia-api --region us-central1 --project vethosia-production
gcloud run revisions describe <REVISION_NUEVA> --service vetia-api --region us-central1 --project vethosia-production --format="value(status.url)"
Invoke-WebRequest https://<REVISION_URL>/v1/health
```

## 4. Smoke API Pre-Trafico

Contra URL de revision:

```powershell
cd api
$env:SMOKE_BASE_URL="https://<REVISION_URL>"
npm run smoke
cd ..
```

Smokes manuales con token real de usuario de prueba:

```powershell
Invoke-WebRequest https://<REVISION_URL>/v1/health
Invoke-WebRequest https://<REVISION_URL>/v1/me -Headers @{ Authorization = "Bearer <ID_TOKEN>" }
Invoke-WebRequest https://<REVISION_URL>/v1/pacientes -Headers @{ Authorization = "Bearer <ID_TOKEN>" }
Invoke-WebRequest https://<REVISION_URL>/v1/consultas -Headers @{ Authorization = "Bearer <ID_TOKEN>" }
Invoke-WebRequest https://<REVISION_URL>/v1/suscripciones/me -Headers @{ Authorization = "Bearer <ID_TOKEN>" }
Invoke-WebRequest https://<REVISION_URL>/v1/pagos/me -Headers @{ Authorization = "Bearer <ID_TOKEN>" }
```

Smoke funcional:

1. Login con usuario legacy.
2. Login con usuario V2 `veterinario`.
3. Crear paciente de prueba.
4. Crear consulta/SOAP.
5. Aprobar consulta.
6. Generar PDF.
7. Verificar que otro tenant no puede leer el recurso.
8. Probar checkout sandbox/controlado y webhook firmado si Wompi queda habilitado.

## 5. Promover Trafico API

Si smokes pasan:

```powershell
gcloud run services update-traffic vetia-api `
  --region us-central1 `
  --project vethosia-production `
  --to-revisions <REVISION_NUEVA>=10,<REVISION_ANTERIOR>=90
```

Monitorear 10-15 minutos:

```powershell
gcloud run services logs read vetia-api --region us-central1 --project vethosia-production --limit 100
```

Si no hay errores P0, subir gradualmente:

```powershell
gcloud run services update-traffic vetia-api --region us-central1 --project vethosia-production --to-revisions <REVISION_NUEVA>=50,<REVISION_ANTERIOR>=50
gcloud run services update-traffic vetia-api --region us-central1 --project vethosia-production --to-revisions <REVISION_NUEVA>=100
```

## 6. Rules Firebase

No cambiar rules si no hubo diferencia respecto al release aprobado. Si se decide desplegarlas, hacerlo despues de indices y antes de frontend:

```powershell
firebase deploy --only firestore:rules,storage --project vethosia-production
```

Smoke minimo despues:

1. Usuario de una cuenta no lee Storage `historiales/{otraCuenta}/...`.
2. Usuario de una cuenta no escribe fotos en `fotos-pacientes/{otraCuenta}/...`.
3. API sigue generando/descargando PDF via `/v1`.

## 7. Deploy Frontend

Configurar variables `VITE_*` de prod en el entorno de build. No incluir secretos de proveedores.

Identificar el site y crear snapshot del canal live antes de publicar:

```powershell
firebase hosting:sites:list --project vethosia-production
$SITE = "vethosia-production"
$ROLLBACK_CHANNEL = "predeploy-$(git rev-parse --short HEAD)"
firebase hosting:clone "${SITE}:live" "${SITE}:$ROLLBACK_CHANNEL" --project vethosia-production
```

Deploy:

```powershell
cd frontend
$env:VITE_API_BASE_URL="https://vetia-api-cwepwj6irq-uc.a.run.app"
npm run build
cd ..
firebase deploy --only hosting --project vethosia-production
```

Smoke frontend:

1. Abrir `https://vethosia.com`.
2. Login email/password.
3. `/dashboard` carga sin errores.
4. Descargar el bundle vivo de `https://vethosia-production.web.app` y confirmar que contiene `vetia-api-cwepwj6irq-uc.a.run.app`.
5. `/v1/me` retorna perfil.
6. Roles canonicos ven modulos correctos.
7. Usuario legacy `asistente` no ve acciones criticas ni modulos V2 nuevos.
8. Admin entidad y admin veterinaria ven vistas separadas.
9. Superadmin queda en soporte/plataforma.
10. Suscripcion muestra plan/cartera/recibos o empty state seguro.

## 8. Monitoreo Post-Deploy

Durante la primera hora:

```powershell
gcloud run services logs read vetia-api --region us-central1 --project vethosia-production --limit 200
```

Vigilar:

- 5xx en Cloud Run.
- 401/403 anormales en `/v1/me`, pacientes, consultas y suscripciones.
- Errores de indice Firestore.
- Errores de Wompi signature/checkout.
- Errores de IA/STT y fallback.
- Latencia de PDF.
- Reintentos de jobs idempotentes.

## 9. Rollback

### API

Volver trafico a revision anterior:

```powershell
gcloud run services update-traffic vetia-api `
  --region us-central1 `
  --project vethosia-production `
  --to-revisions <REVISION_ANTERIOR>=100
```

No borrar la revision nueva hasta capturar logs.

### Frontend

Si Hosting rompe la experiencia y se creo snapshot antes de publicar:

```powershell
$SITE = "vethosia-production"
$ROLLBACK_CHANNEL = "predeploy-<SHA>"
firebase hosting:clone "${SITE}:$ROLLBACK_CHANNEL" "${SITE}:live" --project vethosia-production
```

Si no existe snapshot, usar Firebase Console > Hosting > Release history > Roll back. Si el sitio usa otro `site`, obtenerlo primero:

```powershell
firebase hosting:sites:list --project vethosia-production
```

### Indices

No revertir indices Firestore por rollback de API. Los indices nuevos son aditivos y no rompen legacy. Si tardan en construir, mantener API nueva sin trafico o con trafico 0 hasta `READY`.

### Rules

Si rules nuevas bloquearan usuarios, revertir con el archivo anterior conocido:

```powershell
git checkout <COMMIT_ANTERIOR> -- firestore.rules storage.rules
firebase deploy --only firestore:rules,storage --project vethosia-production
git restore firestore.rules storage.rules
```

No revertir datos ni ejecutar migraciones inversas en caliente.

## 10. Prohibido Durante Este Deploy

- No ejecutar `npm run migrate` contra produccion.
- No ejecutar backfill real.
- No desplegar `functions/` legacy salvo incidente especifico.
- No tocar `api/scripts/ops/`.
- No cambiar Wompi fuera de secrets/config aprobados.
- No activar DIAN ni dunning automatico.
- No retirar fallback legacy `orgId`/`rol`.
