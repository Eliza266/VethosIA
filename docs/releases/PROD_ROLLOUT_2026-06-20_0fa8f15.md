# Production rollout 2026-06-20 - 0fa8f15

## Summary

- Branch: `codex/p18-release-prep-clean`
- Final deployed commit: `0fa8f15 feat(frontend): elevate admin premium experience`
- Rollout time: `2026-06-20 06:15:06 -05:00`
- Hosting live URL: `https://vethosia-production.web.app`
- API live URL: `https://vetia-api-cwepwj6irq-uc.a.run.app`
- Preview URL retained: `https://vethosia-production--preprod-c5d73f0-f4y8ulta.web.app`
- Preview API retained: `https://preprod-c5d73f0---vetia-api-cwepwj6irq-uc.a.run.app`

## API rollout

- Previous live revision: `vetia-api-00047-vay`
- New live revision: `vetia-api-00053-jup`
- New revision tag: `prod-0fa8f15`
- Image: `us-central1-docker.pkg.dev/vethosia-production/vethosia-api/vetia-api:0fa8f15`
- Image digest: `sha256:68b4c355f5796fbd002cc8ad9b057eed5f718abb0883790f27e3c4187cfb5f14`
- Cloud Build id: `b19c5abb-0c31-4ffd-8892-c6e8ef245cd3`
- Traffic before: `vetia-api-00047-vay=100%`
- Traffic after: `vetia-api-00053-jup=100%`
- Rollback API revision: `vetia-api-00047-vay`

Validation:

- Tagged API `/v1/health`: `200`
- Tagged API `/v1/me` without auth: `401`
- Tagged API `/v1/sistema/jobs/run` without worker secret: `401`
- Tagged API `/v1/sistema/configuracion` without auth: `401`
- Live API `/v1/health`: `200`
- Live API `/v1/me` without auth: `401`
- Live API `/v1/sistema/jobs/run` without worker secret: `401`
- Live API `/v1/sistema/configuracion` without auth: `401`
- Cloud Run recent 5xx/errors for `vetia-api-00053-jup`: none found in the checked window.

## Hosting rollout

- Previous live release: `projects/vethosia-production/sites/vethosia-production/channels/live/releases/1781912682371000`
- New live release: `projects/vethosia-production/sites/vethosia-production/channels/live/releases/1781953818000000`
- New live version: `projects/vethosia-production/sites/vethosia-production/versions/fe3f9f9ca68ebf13`
- Hosting root after deploy: `200`
- Rollback Hosting: use the previous live release/version above if live UI regresses.

Build safety:

- Live bundle API base: `https://vetia-api-cwepwj6irq-uc.a.run.app`
- Preview/tagged API was not active in the live bundle.
- Legacy API `https://api.vethosia.com` was not active.
- `fake-api-key` was not active.
- `VITE_EMAIL_REAL_ENABLED=true` was not present.
- `/v1` feature flags were explicitly enabled for HC, IA, Docs and CRUD.

## Test evidence

Local gates:

- `api npm run build`: PASS
- `api npm run test:unit -- --runInBand`: PASS, 43 suites / 451 tests
- `api npm run test:rules`: PASS, 2 suites / 38 tests
- `api npm run test:integration`: PASS, 4 suites / 27 tests, 1 skipped
- `frontend npm run typecheck`: PASS
- `frontend npm run build`: PASS, `verify-prod-build` OK
- `frontend npm run test:run`: PASS, 76 suites / 332 tests
- `frontend npm run e2e -- --workers=1`: PASS, 13 passed / 31 skipped

Visual/auth gates:

- Local visual/auth: PASS, 33/33
- Preview visual/auth after build flag correction: PASS, 33/33
- Production visual/auth: PASS, 33/33

Smoke coverage:

- Public login desktop/mobile
- Veterinario dashboard, pacientes, agenda, vacunas, brigadas, SOAP draft, SOAP approved, PDF/WhatsApp/email-demo actions, RBAC blocked routes
- Admin Veterinaria dashboard, veterinaria panel, pacientes, suscripcion/consumo, brigadas, RBAC blocked routes
- Admin Entidad entidad panel, dashboard, suscripcion/consumo, brigadas, RBAC blocked routes
- Superadmin platform console, planes, suscripciones, auditoria, configuracion, RBAC blocked tenant routes

## Safe operations confirmed

- No push.
- No tag.
- No secrets printed.
- No claims changed.
- No real users modified.
- No real clinical data created or approved.
- No Wompi real activation.
- No real email activation.
- No WhatsApp API activation.
- No destructive migration.
- No real jobs were manually executed.

## Notes and risks

- The build correction required explicit `/v1` feature flags in preview/live builds. Without these flags, the frontend can fall back to legacy Firestore paths.
- Cloud Run deploy reported an IAM policy warning while creating the tagged revision. The tagged and live URLs validated successfully after deployment.
- Existing Scheduler state observed: `vetia-system-jobs-daily` is `ENABLED`. It was not created, executed or modified during this rollout. Review separately whether this should remain enabled for production operations.
- Large frontend chunk warning remains known and non-blocking.
- Demo/smoke credentials should be rotated or regenerated if they were shared outside the release team.

## Rollback

API rollback:

```powershell
gcloud run services update-traffic vetia-api `
  --region us-central1 `
  --project vethosia-production `
  --to-revisions vetia-api-00047-vay=100
```

Hosting rollback:

- Roll back the live channel to previous release `1781912682371000` / version `80663f0ebfecef24` from Firebase Hosting release history.

## Recommendation

Status: `PROD DEPLOY GO / COMPLETADO`

Keep the preview channel `preprod-c5d73f0` until the next review window is complete, then close it with:

```powershell
firebase hosting:channel:delete preprod-c5d73f0 --project vethosia-production
```
