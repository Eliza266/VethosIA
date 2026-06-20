# P2 Visual Frontend Preview - 2026-06-19

## Scope

Deploy visual controlado solo de Firebase Hosting para el rediseño local "Vethosia Clinical Command Center".

No se toca backend, Cloud Run, Functions, Firestore, Auth, Storage, DNS, GitHub, datos reales, claims, cuentas demo ni cleanup.

## Baseline

- Branch: `codex/p18-release-prep-clean`
- HEAD: `561e3ecbb23bcc2431bc251dcfd3cb2aa50ceb53`
- Live objetivo sin dominio propio: `https://vethosia-production.web.app`
- Proyecto Firebase/GCP: `vethosia-production`

## Cambios relevantes incluidos en el build local

- Rediseño visual de shell, navegación y sistema visual base.
- Dashboard veterinario con hero "Clinical Command Center".
- Login rediseñado.
- Cards de pacientes con foco/hover controlado.
- SOAP borrador/aprobada con estilo premium y copy neutral.
- Brigadas con resumen operativo y contexto visual.
- Admin Veterinaria, Admin Entidad y Super Admin con headers visuales consistentes.
- Harness visual autenticado para capturas por rol y SOAP.

## Archivos principales modificados

- `frontend/src/index.css`
- `frontend/src/components/Layout.tsx`
- `frontend/src/components/Navbar.tsx`
- `frontend/src/components/PacienteCard.tsx`
- `frontend/src/components/SoapViewer.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Pacientes.tsx`
- `frontend/src/pages/DetalleConsulta.tsx`
- `frontend/src/pages/Brigadas.tsx`
- `frontend/src/pages/AdminVeterinaria.tsx`
- `frontend/src/pages/AdminEntidad.tsx`
- `frontend/src/pages/SuperAdmin.tsx`
- `frontend/e2e/helpers/visual-auth.ts`
- `frontend/e2e/visual-auth-refresh.spec.ts`
- `frontend/e2e/visual-refresh.spec.ts`
- `frontend/playwright.visual.config.ts`
- `scripts/run-visual-auth.ps1`

## Validacion pre-preview

- `cd frontend; npm run typecheck`: PASS
- `cd frontend; npm run build`: PASS
- `frontend/scripts/verify-prod-build.mjs`: PASS, live API permitida y proyecto `vethosia-production`
- `cd frontend; npm run test:run`: PASS, 69 files / 318 tests
- Smoke visual local: PASS previo, 33/33 contra `http://127.0.0.1:5173`

Nota: el build mantiene el warning conocido de chunk mayor a 500 kB.

## Seguridad

- `VITE_EMAIL_REAL_ENABLED`: ausente en shell productiva de build; el smoke fuerza `false`.
- No se activan email real, WhatsApp API real, Wompi ni jobs.
- `.env.e2e.local`, `.auth/` y `e2e-screenshots/` estan ignorados por Git.
- La busqueda de patrones sensibles encontro nombres de variables/fixtures/documentacion, sin imprimir valores.

## Preview

- Estado: deploy preview ejecutado, Hosting-only.
- Canal inicial: `visual-command-center-p2`.
- URL inicial: `https://vethosia-production--visual-command-center-p2-0u4ngy3g.web.app`.
- Resultado inicial: NO-GO para smoke autenticado. La UI cargaba, pero `/v1/me` no resolvia correctamente desde ese origen y las rutas quedaban en estado invitado/loading. No se cambio backend/CORS por estar fuera de alcance.
- Canal final usado para revision: `p19-ab8fe87`, ya usado previamente para smoke preview y compatible con el allowlist existente.
- URL preview final: `https://vethosia-production--p19-ab8fe87-iji7tgzy.web.app`.
- Smoke preview autenticado final: PASS, 33/33.
- Capturas: `frontend/e2e-screenshots/visual-refresh-auth/` y `frontend/e2e-screenshots/visual-refresh/`.

## Resultado smoke preview final

- Login publico desktop/mobile: PASS.
- Veterinario: login, dashboard desktop/mobile/tablet, pacientes, agenda, vacunas, brigadas, SOAP borrador, SOAP aprobada, PDF/WhatsApp/email demo y RBAC: PASS.
- Admin Veterinaria: login, dashboard, veterinaria, pacientes, suscripcion/consumo, brigadas y RBAC: PASS.
- Admin Entidad: login, entidad, dashboard, suscripcion/consumo, brigadas y RBAC: PASS.
- Super Admin: login, admin, modulos centralizados y RBAC: PASS.
- Email demo: PASS, sin POST real a `/email`.
- Hosting live: no modificado.
- Cloud Run/API: no modificado.
- Firestore/Auth/Storage: no modificado.
- DNS/dominio propio: no modificado.

## Riesgos

- Warning de bundle grande pendiente de optimizacion futura.
- Worktree local permanece sucio porque el rediseño aun no esta commiteado.
- El deploy preview usa el artefacto local `frontend/dist`; no representa un commit remoto porque GitHub queda fuera de alcance.
- El canal preview nuevo `visual-command-center-p2` no es apto para smoke autenticado mientras el backend no permita ese origen; se deja sin promocion live.
