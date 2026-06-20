# Clinical role hotfix 2026-06-20 — d8cef5b

## Summary

- Branch: `codex/p18-release-prep-clean`
- Fix commit: `d8cef5b fix(frontend): harden clinical role experience`
- Refinement commit: `1b42259 fix(frontend): refine veterinarian document actions`
- Docs commit (pre-deploy): `d4037d2 docs(release): record clinical role hotfix`
- Deploy docs commit: `1ca1c5a docs(release): record clinical role hotfix deploy`
- Previous production commit: `0fa8f15 feat(frontend): elevate admin premium experience`
- Scope: Veterinario, Admin Veterinaria, Admin Entidad (Superadmin untouched)
- Rollout type: **Hosting-only (frontend)** — sin Cloud Run / sin tráfico API
- Hosting live URL: `https://vethosia-production.web.app`
- Preview URL: `https://vethosia-production--preprod-c5d73f0-f4y8ulta.web.app`
- API live URL: `https://vetia-api-cwepwj6irq-uc.a.run.app`
- Preview channel: `preprod-c5d73f0` (expira 2026-06-27)

## What was fixed

1. **Notificaciones** — panel en portal `fixed` (z-index 9990), backdrop click-outside, cierre en navegación/Escape; navbar sin `overflow-x-clip`.
2. **Veterinario command center** — jerarquía Prioridad clínica / Operación diaria / Documentos controlados; microcopy con acentos.
3. **PDF / Email demo / WhatsApp** — rutas contextuales vía `clinicalDocuments.ts` y hub `/documentos?accion=...`; sin envíos reales.
4. **Consultas recientes** — nombres QA/hash humanizados (`clinicalLabels.ts`).
5. **Admin Veterinaria / Admin Entidad** — copy premium, responsive grids, protección demo `@vethosia.test` en Guardar/Invitar/Bloquear.
6. **Footer** — reemplazado “Privacidad (próximamente)” por enlace “Privacidad y datos”.
7. **Refinement Veterinario (`1b42259`)** — eliminada sección “Documentos controlados” como cards angostas; PDF/Email/WhatsApp pasan a **acciones compactas por consulta aprobada** en “Consultas recientes”; “Operación diaria” ocupa ancho completo con cards normales (Agenda, Vacunas, Brigadas, Nuevo paciente).

## Build safety (preview + live)

- API base bundle: `https://vetia-api-cwepwj6irq-uc.a.run.app`
- `VITE_USE_API_HC/IA/DOCS/CRUD=true`
- `VITE_EMAIL_REAL_ENABLED=false`
- `VITE_USE_FIREBASE_EMULATORS=false`
- `verify-prod-build`: PASS (live target)
- Sin `localhost`, sin `fake-api-key`, sin API preview tagged en bundle live
- Bundle principal: `index-BSHH4LQJ.js` (refinement `1b42259`)

## Deploy timeline (2026-06-20)

| Paso | Hora (-05:00) | Resultado |
|------|---------------|-----------|
| Preview `preprod-c5d73f0` (initial) | ~09:47 | PASS |
| Smoke preview (initial) | ~09:48–09:51 | **33/33 PASS** |
| Hosting live (initial) | ~09:51 | PASS |
| Smoke producción (initial) | ~09:51–09:54 | **33/33 PASS** |
| Preview `preprod-c5d73f0` (refinement) | ~10:04 | PASS |
| Smoke preview (refinement) | ~10:04–10:07 | **33/33 PASS** |
| Hosting live (refinement) | ~10:07 | PASS |
| Smoke producción (refinement) | ~10:08–10:11 | **33/33 PASS** |

## Test evidence

### Gates locales (pre-deploy)

- `frontend npm run typecheck`: PASS
- `frontend npm run build` + `verify-prod-build`: PASS
- `frontend npm run test:run`: PASS — 78 suites / 339 tests
- `frontend npm run e2e -- --workers=1`: PASS — 13 passed / 31 skipped

### Preview smoke

```powershell
.\scripts\run-visual-auth.ps1 -BaseUrl "https://vethosia-production--preprod-c5d73f0-f4y8ulta.web.app" -SkipBuild
```

- Resultado: **33/33 PASS**
- Cobertura: Veterinario (dashboard responsive, pacientes, agenda, vacunas, brigadas, SOAP borrador/aprobada, PDF/WhatsApp/email demo, RBAC), Admin Veterinaria, Admin Entidad, Superadmin (sin regresión), login público, logout vía flujos auth

### Production smoke

```powershell
.\scripts\run-visual-auth.ps1 -BaseUrl "https://vethosia-production.web.app" -SkipBuild
```

- Resultado: **33/33 PASS**

### API checks (sin auth)

- Hosting live root: **200**
- `/v1/health`: **200**
- `/v1/me` sin Bearer: **401**
- `/v1/sistema/jobs/run` sin secreto: **401**

## Cloud Run / backend

- **Sin deploy Cloud Run**
- **Sin `update-traffic`**
- Tráfico API sin cambios (revisión live heredada del rollout `0fa8f15`: `vetia-api-00053-jup`)

## Rollback

### Hosting live

Revertir en Firebase Console → Hosting → Release history al release anterior a este hotfix (deploy previo commit `0fa8f15`, release `1781953818000000` / version `fe3f9f9ca68ebf13` según `PROD_ROLLOUT_2026-06-20_0fa8f15.md`).

### API

No aplica — backend no fue modificado.

## Safe operations confirmed

- No push / no tag
- No backend deploy / no Cloud Run traffic change
- No secrets printed in logs
- No claims / users / clinical data touched
- No Wompi / email real / WhatsApp API / jobs productivos
- Demo accounts protected by email heuristic only (`demoSession.ts`)

## Recommendation

**PROD DEPLOY GO / COMPLETADO** — listo para demo comercial en Veterinario, Admin Veterinaria y Admin Entidad. Superadmin smoke 33/33 sin regresión.
