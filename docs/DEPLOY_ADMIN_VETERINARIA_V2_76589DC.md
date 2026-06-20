# Deploy productivo — Admin Veterinaria V2 (`76589dc`)

Registro de release controlado. **No sustituye** runbooks operativos ni backups en `tmp/`.

## 1. Fecha

**2026-06-17** (deploy controlado API + Hosting, sin migración de datos ni usuarios nuevos).

## 2. Commit desplegado

| Campo | Valor |
|-------|-------|
| Hash | `76589dc097c729b4b93ec0d46e634abe60e361e8` |
| Mensaje | `feat(rbac): add admin veterinaria scope support` |
| Alcance código | Soporte aditivo RBAC V2 admin veterinaria (API `/v1/me`, invitaciones, UI, tests); **sin** crear usuario prod |

## 3. API Cloud Run

| Campo | Valor |
|-------|-------|
| Revisión activa | `vetia-api-00030-lab` |
| Tag | `admin-vet-v2-76589dc` |
| Imagen digest | `sha256:9f12cecec42e1cd1f9b84c5fb95d3babd7d564605cc25945587e4b2a5557f4e2` |
| Tráfico | **100%** en `vetia-api-00030-lab` |

## 4. Rollback

| Campo | Valor |
|-------|-------|
| Revisión anterior | `vetia-api-00026-yot` |
| Tag referencia | `rc-c06d908` |

## 5. URLs productivas

| Servicio | URL |
|----------|-----|
| Frontend Hosting | https://vethosia-production.web.app |
| API principal | https://vetia-api-cwepwj6irq-uc.a.run.app |

## 6. Tests ejecutados (pre-deploy / gate local)

| Suite | Resultado |
|-------|-----------|
| API unit — `access-v2`, `guards`, `me.controller`, `invitaciones`, `tenant`, `suscripciones` | OK (incluidos en commit `76589dc`) |
| Frontend unit — `rbac`, `RoleRoute`, `SubscriptionRoute`, `AdminVeterinaria`, `Navbar`, `Suscripcion`, `BusinessOverview` | OK |
| Build API (Docker) | OK con deuda npm reportada (ver riesgos) |
| Build frontend producción | OK — bundle apunta a API `vetia-api-cwepwj6irq-uc.a.run.app` |

## 7. Smoke API

| Target | Resultado |
|--------|-----------|
| Revisión tagged `admin-vet-v2-76589dc` | OK |
| API principal (`vetia-api-cwepwj6irq-uc.a.run.app`) | OK |
| Endpoints tenant (`/v1/me`, pacientes, consultas, suscripciones, pagos) | OK con usuarios existentes |

## 8. Smoke web por rol

Usuarios `@vethosia.com` activos (sin crear cuentas nuevas en este deploy):

| Usuario | Rol efectivo | Resultado smoke |
|---------|--------------|-----------------|
| `gerencia@vethosia.com` | Admin Entidad | Login OK · Dashboard OK · Suscripción accesible · Pacientes/consultas OK |
| `veterinario@vethosia.com` | Veterinario vinculado | Login OK · Sin bloque plan/consumo en Dashboard · Sin Suscripción en navbar · `/suscripcion` bloqueado |
| `superadmin@vethosia.com` | Super Admin | Login OK · Sin gestión tenant `/suscripcion` · Soporte/plataforma OK |

## 9. Confirmaciones de límites del deploy

| Límite | Cumplido |
|--------|----------|
| **No** se creó `admin.veterinaria@vethosia.com` | ✓ |
| **No** se creó `sistema@vethosia.com` | ✓ |
| **No** se cambiaron custom claims de usuarios reales | ✓ |
| **No** hubo backfill de data clínica | ✓ |
| **No** hubo escrituras Firestore productivas para scope V2 | ✓ |
| **No** se tocó `.env` | ✓ |
| **No** se tocó `api/scripts/ops/` | ✓ |
| Stash ops intacto | ✓ |

Ver decisión de scope: `docs/ADMIN_VETERINARIA_SCOPE_DECISION.md`.

## 10. Riesgos restantes

| ID | Riesgo | Estado |
|----|--------|--------|
| R1 | Falta **scope real** de `veterinariaId` en producción (`veterinarias/` vacía) | Pendiente |
| R2 | Falta **backfill controlado** org legacy → `veterinariaId` / `entidadId` | Pendiente |
| R3 | Modelo **convive con `orgId` legacy**; data clínica aún por `orgId` | Activo |
| R4 | **Deuda npm** reportada durante Docker build API | Observar en próximo release |
| R5 | Usuario `admin.veterinaria@vethosia.com` sigue **no creado** hasta pre-requisitos de scope | Por diseño |

## 11. Próximo paso recomendado (fuera de este deploy)

1. Definir y crear `veterinarias/{veterinariaId}` en prod con mapping revisado.
2. Validar `/v1/me` en prod con claims V2 de prueba en entorno controlado.
3. Crear `admin.veterinaria@vethosia.com` solo tras `CONFIRMO_CREAR_ADMIN_VETERINARIA_VETHOSIA` y scope listo.

## Referencias

- `docs/ADMIN_VETERINARIA_SCOPE_DECISION.md`
- `docs/RBAC_TENANT_MODEL_V2.md`
- `docs/DATA-MODEL.md`
- Registro privado de reconciliacion de usuarios productivos, no versionado en repo.
- Deploy frontend previo RBAC linked vets: commit `c3b239f`
