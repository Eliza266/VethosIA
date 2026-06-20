# Plan documental de migración de claims V2 (producción)

**Estado:** solo documentación — **no ejecutar** cambios hasta completar checklist y clasificación manual de organizaciones.  
**Proyecto:** `vethosia-production`  
**Auditoría fuente:** `tmp/role-audit-prod.md` (2026-06-17, read-only)  
**HEAD repo al redactar:** `427e2f6`  
**Referencias:** `docs/RBAC_TENANT_MODEL_V2.md`, `docs/DATA-MODEL.md`, `docs/ADR/ADR-0006-rbac-tenant-v2.md`, `api/src/modules/tenant/claims-v2.ts`

---

## 1. Estado actual de usuarios por rol

Inventario confirmado en producción (Auth + miembros Firestore, sin escrituras).

| Categoría | Count | Detalle |
|-----------|------:|---------|
| Usuarios Auth auditados | 10 | Todos con claim legacy `rol`; ninguno con `role` V2 ni `v=2` |
| Miembros Firestore (`miembros/{uid}`) | 8 | Los 2 superadmin no tienen documento en `miembros` |
| Invitaciones pendientes | 0 | Colección vacía en muestra |
| Organizaciones con usuarios | 2 | Ver tabla de clasificación abajo |

### Distribución por rol efectivo (normalización UI)

| Rol canónico / estado | Count | Usuarios |
|-----------------------|------:|----------|
| **superadmin** | 2 | `gerencia+superadmin@nextvoiceia.com`, `superadmin@vethosia.com` |
| **admin_entidad** (legacy `admin`) | 4 | `gerencia@nextvoiceia.com`, `gerencia+admin@nextvoiceia.com`, `gerencia+entidad@nextvoiceia.com`, `gerencia@vethosia.com` |
| **admin_veterinaria** | 0 | No existe en prod |
| **veterinario** (legacy `vet`) | 2 | `gerencia+veterinario@nextvoiceia.com`, `veterinario@vethosia.com` |
| **asistente** (legacy, deprecated) | 2 | `asistente@vethosia.com`, `gerencia+asistente@nextvoiceia.com` |
| **sistema** (actor interno) | 0 | Confirmado: no hay usuario Auth con `rol`/`role=sistema` |
| **role=asistente V2** | 0 | Ningún claim `role` inválido |

### Clasificación de organizaciones (prerrequisito manual)

| orgId legacy | Nombre conocido | Usuarios asignados | Clasificación propuesta | Estado |
|--------------|-----------------|-------------------|-------------------------|--------|
| `GT1BZbIdWWS7fANv3EUW` | **Vethosia** (bootstrap documentado) | 6 usuarios tenant | **Entidad** (`accountType=entidad`) | Confirmado por docs (`docs/VETHOSIA_PROD.md`, bootstrap) |
| `iVQURlMlESO5af6hbQ8I` | Desconocido (emails `@vethosia.com`) | 3 usuarios tenant | **Requiere revisión humana** — puede ser entidad, veterinaria independiente u org de prueba | **No inferir** hasta consultar `organizaciones/{orgId}` y negocio |

> **Regla ADR-0006:** no mapear `admin` → `admin_entidad` ni `admin_veterinaria` sin tabla de clasificación explícita por `orgId`. Un `orgId` puede representar entidad o veterinaria; no se asume por el nombre del email.

---

## 2. Tabla usuario por usuario

Convenciones para IDs propuestos (placeholders hasta backfill de colecciones `entidades/` y `veterinarias/`):

- Entidad desde org legacy: `ent_{orgId}` (ej. `ent_GT1BZbIdWWS7fANv3EUW`)
- Veterinaria independiente desde org legacy: `vetclin_{orgId}` (ej. `vetclin_iVQURlMlESO5af6hbQ8I`)
- Veterinario staff: `accountId` = cuenta clínica de la sede/entidad; `vinculoTipo=staff`
- `membershipId` propuesto: `m_{uid8}_{orgId8}` (sustituir por ID canónico cuando exista `miembros/{membershipId}`)

| email | uid abrev. | rol legacy | role V2 propuesto | orgId actual | accountId propuesto | accountType propuesto | entidadId propuesto | veterinariaId propuesto | planOwnerType propuesto | planOwnerId propuesto | membershipId propuesto | acción recomendada | riesgo |
|-------|------------|------------|-------------------|--------------|---------------------|----------------------|---------------------|-------------------------|-------------------------|----------------------|------------------------|--------------------|--------|
| `gerencia+superadmin@nextvoiceia.com` | `i415ol61…` | `superadmin` | `superadmin` | — | — (no requerido) | — | — | — | — | — | — (exento V2) | Migrar claims V2 en lote 1; conservar `rol=superadmin`; sin `orgId`/`accountId` | Bajo — solo rutas soporte auditadas |
| `superadmin@vethosia.com` | `tiJ7iCSL…` | `superadmin` | `superadmin` | — | — | — | — | — | — | — | — | Idem superadmin anterior; validar si cuenta duplicada de prueba | Medio — duplicidad operativa |
| `gerencia@nextvoiceia.com` | `h2TTdGOV…` | `admin` | `admin_entidad` | `GT1BZbIdWWS7fANv3EUW` | `ent_GT1BZbIdWWS7fANv3EUW` | `entidad` | `ent_GT1BZbIdWWS7fANv3EUW` | — | `entidad` | `ent_GT1BZbIdWWS7fANv3EUW` | `m_h2TTdGOV_GT1BZbId` | Lote 2 tras clasificar org; conservar `orgId`+`rol=admin` en claims | Medio — admin bootstrap; validar `/v1/me` y navbar |
| `gerencia+admin@nextvoiceia.com` | `JfLoyEtX…` | `admin` | `admin_entidad` | `GT1BZbIdWWS7fANv3EUW` | `ent_GT1BZbIdWWS7fANv3EUW` | `entidad` | `ent_GT1BZbIdWWS7fANv3EUW` | — | `entidad` | `ent_GT1BZbIdWWS7fANv3EUW` | `m_JfLoyEtX_GT1BZbId` | Lote 2; evaluar si es cuenta de prueba redundante | Bajo/Medio |
| `gerencia+entidad@nextvoiceia.com` | `tjrGMNAJ…` | `admin` | `admin_entidad` | `GT1BZbIdWWS7fANv3EUW` | `ent_GT1BZbIdWWS7fANv3EUW` | `entidad` | `ent_GT1BZbIdWWS7fANv3EUW` | — | `entidad` | `ent_GT1BZbIdWWS7fANv3EUW` | `m_tjrGMNAJ_GT1BZbId` | Lote 2; nombre sugiere entidad — confirmar con negocio | Bajo |
| `gerencia@vethosia.com` | `GyyiBRBU…` | `admin` | `admin_entidad` **o** `admin_veterinaria` | `iVQURlMlESO5af6hbQ8I` | **Pendiente clasificación org** | **Pendiente** | `ent_iVQURlMl…` si entidad; `vetclin_iVQURlMl…` si clínica | `vetclin_iVQURlMl…` solo si clínica | **Pendiente** | **Pendiente** | `m_GyyiBRBU_iVQURlMl` | **Detener hasta decisión humana** sobre tipo de `iVQURlMl…` | **Alto** — riesgo de mapear admin al scope equivocado |
| `gerencia+veterinario@nextvoiceia.com` | `B7YxFabL…` | `vet` | `veterinario` | `GT1BZbIdWWS7fANv3EUW` | `ent_GT1BZbIdWWS7fANv3EUW` | `entidad` | `ent_GT1BZbIdWWS7fANv3EUW` | — | `entidad` | `ent_GT1BZbIdWWS7fANv3EUW` | `m_B7YxFabL_GT1BZbId` | Lote 3 (vets); **no tocar** hasta admins migrados; conservar `rol=vet` | Medio — claims stale; herencia de plan entidad |
| `veterinario@vethosia.com` | `LJacuiW0…` | `vet` | `veterinario` | `iVQURlMlESO5af6hbQ8I` | **Pendiente** (`ent_…` o `vetclin_…`) | **Pendiente** | según clasificación org | `vetclin_…` si aplica | **Pendiente** | **Pendiente** | `m_LJacuiW0_iVQURlMl` | Lote 3 tras clasificar org `iVQURlMl…` | **Alto** — depende de clasificación org |
| `asistente@vethosia.com` | `Fr2KQe6A…` | `asistente` | — (sin role V2) | `iVQURlMlESO5af6hbQ8I` | — | — | — | — | — | — | — | **Opción A (recomendada):** desactivar Auth + documentar. **Opción B:** reinvitar con rol canónico si negocio lo exige. **No** mapear a `veterinario` | Medio — rol deprecated activo |
| `gerencia+asistente@nextvoiceia.com` | `vNFbSA8D…` | `asistente` | — (sin role V2) | `GT1BZbIdWWS7fANv3EUW` | — | — | — | — | — | — | — | Idem asistente; probable cuenta de prueba — desactivar o reinvitar | Medio |

### Ejemplo de payload V2 objetivo (referencia, no aplicar)

Para `admin_entidad` en Vethosia (tras crear documentos `entidades/` y membership):

```json
{
  "v": 2,
  "role": "admin_entidad",
  "accountType": "entidad",
  "accountId": "ent_GT1BZbIdWWS7fANv3EUW",
  "entidadId": "ent_GT1BZbIdWWS7fANv3EUW",
  "membershipId": "m_h2TTdGOV_GT1BZbId",
  "planOwnerType": "entidad",
  "planOwnerId": "ent_GT1BZbIdWWS7fANv3EUW",
  "orgId": "GT1BZbIdWWS7fANv3EUW",
  "rol": "admin"
}
```

Para `veterinario` staff bajo entidad:

```json
{
  "v": 2,
  "role": "veterinario",
  "accountType": "entidad",
  "accountId": "ent_GT1BZbIdWWS7fANv3EUW",
  "entidadId": "ent_GT1BZbIdWWS7fANv3EUW",
  "membershipId": "m_B7YxFabL_GT1BZbId",
  "planOwnerType": "entidad",
  "planOwnerId": "ent_GT1BZbIdWWS7fANv3EUW",
  "vinculoTipo": "staff",
  "orgId": "GT1BZbIdWWS7fANv3EUW",
  "rol": "vet"
}
```

Para `superadmin`:

```json
{
  "v": 2,
  "role": "superadmin",
  "rol": "superadmin"
}
```

(`buildMembershipClaimsV2` en `claims-v2.ts` no exige `membershipId` para `superadmin`.)

---

## 3. Propuesta para los 4 admin legacy

### Org `GT1BZbIdWWS7fANv3EUW` (Vethosia) — 3 admins

| Usuario | Propuesta |
|---------|-----------|
| `gerencia@nextvoiceia.com` | `admin_entidad` — org documentada como entidad bootstrap |
| `gerencia+admin@nextvoiceia.com` | `admin_entidad` — misma org; verificar si cuenta de prueba puede consolidarse |
| `gerencia+entidad@nextvoiceia.com` | `admin_entidad` — coherente con nombre y org |

**Condición:** crear/verificar `entidades/ent_GT1BZbIdWWS7fANv3EUW` con `legacyOrgId=GT1BZbIdWWS7fANv3EUW` antes de claims.

### Org `iVQURlMlESO5af6hbQ8I` — 1 admin

| Usuario | Propuesta |
|---------|-----------|
| `gerencia@vethosia.com` | **Requiere revisión humana antes de convertir** |

Árbol de decisión:

1. Si `organizaciones/iVQURlMl…` representa **entidad** → `role=admin_entidad`, scopes `ent_iVQURlMl…`.
2. Si representa **veterinaria/hospital independiente** → `role=admin_veterinaria`, scopes `vetclin_iVQURlMl…`, `planOwnerType=veterinaria`.
3. Si es **org de prueba/descartable** → no migrar; desactivar usuarios asociados.

**No** mapear automáticamente los 4 admins a `admin_entidad` sin completar clasificación de `iVQURlMl…`.

---

## 4. Propuesta para los 2 vet legacy

| Usuario | orgId | Propuesta |
|---------|-------|-----------|
| `gerencia+veterinario@nextvoiceia.com` | `GT1BZbIdWWS7fANv3EUW` | `role=veterinario`; conservar `orgId` y `rol=vet` hasta cierre de migración |
| `veterinario@vethosia.com` | `iVQURlMlESO5af6hbQ8I` | `role=veterinario`; scopes dependen de clasificación org; conservar legacy |

**Orden:** migrar después de admins de la misma org (lote 3).  
**Plan:** veterinarios bajo entidad heredan `planOwnerType=entidad` y `planOwnerId` de la entidad (no pagan individual).  
**Rollback:** restaurar snapshot `{ orgId, rol: 'vet' }` sin borrar campos V2.

---

## 5. Propuesta para los 2 asistente legacy

| Usuario | Estado actual | Recomendación |
|---------|---------------|---------------|
| `asistente@vethosia.com` | `LEGACY_ASISTENTE_LIMITADO`, activo | **Opción recomendada:** desactivar en Auth tras ventana de comunicación, o eliminar acceso vía bloqueo de miembro |
| `gerencia+asistente@nextvoiceia.com` | Idem | Idem; probable alias de prueba |

Reglas explícitas:

- **No** mapear automáticamente a `veterinario`.
- **No** asignar `role` V2 ni permisos V2 nuevos.
- **No** usar `role=asistente` en claims V2 (inválido).
- Si negocio requiere acceso clínico: **reinvitar** con `veterinario` o rol administrativo canónico tras decisión formal — no “upgrade” silencioso.
- Mantener limitado (`LEGACY_ASISTENTE_LIMITADO`) hasta decisión humana documentada.

---

## 6. Superadmin

| Usuario | Tratamiento |
|---------|-------------|
| `gerencia+superadmin@nextvoiceia.com` | Conservar `role=superadmin`; sin `accountId`, `orgId`, `membershipId` |
| `superadmin@vethosia.com` | Idem |

Requisitos:

- Acceso solo por endpoints/rutas con `@Roles('superadmin')` y auditoría (matriz R96, R121).
- No exigir `accountId` ni contexto tenant (coherente con `buildMembershipClaimsV2`).
- Evaluar consolidación a **una** cuenta superadmin operativa en prod.
- Tras migración: `revokeRefreshTokens` + logout/login obligatorio.

---

## 7. Rollback

Antes de cualquier `setCustomUserClaims` en ejecución futura:

1. **Snapshot lógico por usuario** (JSON en artefacto de migración, fuera del repo si contiene PII):
   - `uid`, `email`, claims completos actuales (`customClaims` raw)
   - Documento `miembros/{uid}` si existe
   - Timestamp y `migrationRunId`
2. **Conservar siempre** `orgId` y `rol` legacy en claims durante Fase 1–3 (doble compatibilidad).
3. **No borrar** campos V2 en rollback — usar `buildLegacyClaimsRollbackV2` / `rollbackLegacyClaimsV2` (`claims-v2.ts`): restaura `orgId`/`rol` sobre claims actuales.
4. **`revokeRefreshTokens(uid)`** inmediatamente después de cada cambio de claims.
5. **Forzar** `getIdToken(true)` o logout/login en cliente; sesiones con token viejo conservan permisos stale (riesgo P0).
6. Si falla lote: pausar por `migrationRunId`; revertir solo usuarios del lote afectado desde snapshot.

---

## 8. Comandos o pseudocomandos futuros

> ### ⛔ NO EJECUTAR TODAVÍA
>
> Esta sección es referencia para una ventana de mantenimiento futura. No incluye tokens ni secretos.

### 8.1 Clasificación dry-run de organizaciones (read-only)

```bash
# Leer metadata de orgs legacy (sin escribir)
# Pseudocomando: consultar organizaciones/{orgId} para GT1BZbIdWWS7fANv3EUW e iVQURlMlESO5af6hbQ8I
# Registrar: nombre, plan, tipoNegocio, migrationStatus
```

### 8.2 Snapshot de claims antes de migrar (read-only → archivo local seguro)

```bash
# Por cada uid en el lote:
# Pseudocomando Admin SDK / REST:
#   getUser(uid) → guardar customClaims + email en snapshots/claims-{migrationRunId}.json
```

### 8.3 Aplicar claims V2 (un usuario, tras checklist)

```typescript
// Pseudocódigo — usar applyMembershipClaimsV2 de api/src/modules/tenant/claims-v2.ts
await applyMembershipClaimsV2(auth, uid, {
  role: 'admin_entidad',
  accountType: 'entidad',
  accountId: 'ent_GT1BZbIdWWS7fANv3EUW',
  entidadId: 'ent_GT1BZbIdWWS7fANv3EUW',
  membershipId: 'm_h2TTdGOV_GT1BZbId',
  planOwnerType: 'entidad',
  planOwnerId: 'ent_GT1BZbIdWWS7fANv3EUW',
  orgId: 'GT1BZbIdWWS7fANv3EUW',
  rol: 'admin',
});
// Implica: setCustomUserClaims + revokeRefreshTokens
```

### 8.4 Rollback de un usuario

```typescript
await rollbackLegacyClaimsV2(auth, uid, currentClaims, {
  orgId: 'GT1BZbIdWWS7fANv3EUW',
  rol: 'admin',
});
```

### 8.5 Smoke post-cambio

```bash
# Con ID token del usuario migrado (obtenido en sesión humana, no automatizar en CI con password):
curl -sS -H "Authorization: Bearer <ID_TOKEN>" "https://<API_BASE>/v1/me"
# Esperado: role V2 + orgId/rol legacy preservados
```

### 8.6 Re-auditoría read-only

```bash
Remove-Item Env:FIRESTORE_EMULATOR_HOST -ErrorAction SilentlyContinue
Remove-Item Env:FIREBASE_AUTH_EMULATOR_HOST -ErrorAction SilentlyContinue
$env:GCLOUD_PROJECT='vethosia-production'
node tmp/audit-roles-readonly.cjs
```

---

## 9. Checklist para ejecución futura

### Pre-migración

- [ ] Aprobación formal de ventana de mantenimiento
- [ ] Clasificación manual completada para **todas** las orgs con usuarios (`GT1BZb…` ✓, `iVQURlMl…` pendiente)
- [ ] Decisión documentada sobre 2 cuentas `asistente`
- [ ] Backup lógico Auth/claims (snapshot JSON por uid)
- [ ] Backup Firestore (`organizaciones`, `miembros`, y colecciones clínicas si aplica)
- [ ] `migrationRunId` y runbook asignados
- [ ] Rollback probado en emulador con `claims-v2.spec.ts` (R90, R95)

### Ejecución por lotes

| Lote | Usuarios | Orden |
|------|----------|-------|
| 0 | Clasificación org + crear docs `entidades/`/`veterinarias/` si faltan | Primero |
| 1 | 2 superadmin | Tras lote 0 |
| 2 | 3 admin Vethosia (`GT1BZb…`) | Tras lote 0 |
| 3 | 2 veterinarios Vethosia | Tras lote 2 |
| 4 | Admin + vet + asistente de `iVQURlMl…` | Solo tras clasificación org |
| 5 | Asistentes | Decisión humana: desactivar o reinvitar (no migrar a V2) |

Por cada usuario en lote:

- [ ] Snapshot claims guardado
- [ ] `applyMembershipClaimsV2` (o script equivalente auditado)
- [ ] Smoke `GET /v1/me`
- [ ] Smoke roles frontend (navbar, rutas protegidas)
- [ ] Revisar logs API / auditoría
- [ ] Si falla: `rollbackLegacyClaimsV2` desde snapshot y detener lote

### Post-migración

- [ ] Re-ejecutar auditoría read-only (`tmp/audit-roles-readonly.cjs`)
- [ ] Verificar 0 `SCOPE_INCONSISTENTE`, 0 claims inválidos
- [ ] Actualizar `docs/qa/matriz.md` si aplica
- [ ] Periodo de observación 24–72 h antes de retirar flags legacy

---

## 10. Riesgos

| ID | Riesgo | Impacto | Mitigación |
|----|--------|---------|------------|
| R1 | `orgId` puede ser entidad o veterinaria; inferir sin clasificación | Acceso cruzado o pérdida de admin | Tabla manual §1; bloquear lote 4 hasta decisión |
| R2 | Usuarios `asistente` activos | Permisos legacy fuera del modelo V2 | Desactivar o reinvitar; no auto-mapear |
| R3 | Claims stale hasta refresh | Usuario conserva permisos viejos | `revokeRefreshTokens` + logout/login obligatorio |
| R4 | `admin_veterinaria` no existe en usuarios reales | Primer caso será `gerencia@vethosia.com` si org es clínica | Probar en emulador antes de prod |
| R5 | 10 cuentas, muchas alias `gerencia+*` | Confusión operativa, snapshots incorrectos | Inventario email→uid verificado antes de lote |
| R6 | Miembros Firestore (8) ≠ Auth (10) | Superadmin sin `miembros/{uid}` es OK; no crear miembros fantasma | No inventar `membershipId` sin documento |
| R7 | ADC `invalid_rapt` en entorno local | Auditoría/script Admin SDK falla | Usar REST read-only o reauth; no bloquea migración si SA con permisos en ventana |
| R8 | Migrar vets antes que admins | `planOwnerId`/scope inconsistente | Orden de lotes §9 |
| R9 | Duplicar superadmin | Dos cuentas con acceso plataforma | Consolidar o documentar ambas como operativas |

---

## Recomendación final

| Veredicto | Detalle |
|-----------|---------|
| **Operación actual** | **OK** con modelo legacy — sin usuarios inválidos ni `sistema` en Auth |
| **Migración V2** | **Requiere migración planificada** — 8 usuarios migrables tras clasificación; 2 asistentes requieren decisión humana |
| **Bloqueante P0** | Clasificar `organizaciones/iVQURlMlESO5af6hbQ8I` antes de tocar `gerencia@vethosia.com`, `veterinario@vethosia.com` y `asistente@vethosia.com |
| **Ajuste manual** | Decidir destino de 2 `asistente`; evaluar consolidación de cuentas `gerencia+*` de prueba |

---

*Documento generado por auditoría RBAC. No se ejecutó migración, no se modificó producción.*
