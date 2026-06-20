import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from './auth-user.interface';
import {
  canAccessRuntimeResource,
  clinicalScopeForCreate,
  resolveMembershipContext,
  runtimeTenantFilter,
  type RuntimeResourceScope,
} from './runtime-v2';

// El dueño de VetIA (superadmin) tiene supervision cross-tenant.
export function esSuperadmin(user: AuthUser): boolean {
  return user.rol === 'superadmin';
}

// Misma logica que firestore.rules pero del lado de la API (que usa Admin SDK y se
// salta las reglas, asi que el chequeo lo hacemos a mano). Regla: superadmin pasa
// siempre; si el usuario tiene orgId, debe coincidir con el del doc; si no (legacy),
// cae a veterinarioId == uid.
export function puedeAccederDoc(
  user: AuthUser,
  doc: { orgId?: string; veterinarioId?: string } & Partial<RuntimeResourceScope>,
): boolean {
  const ctx = resolveMembershipContext(user);
  if (ctx.mode === 'v2') return canAccessRuntimeResource(user, doc);
  if (esSuperadmin(user)) return true;
  if (user.orgId && doc.orgId) {
    return user.orgId === doc.orgId;
  }
  // fallback legacy: dueño por veterinarioId.
  return !!doc.veterinarioId && doc.veterinarioId === user.uid;
}

export function assertAcceso(
  user: AuthUser,
  doc: { orgId?: string; veterinarioId?: string } & Partial<RuntimeResourceScope>,
): void {
  if (!puedeAccederDoc(user, doc)) {
    throw new ForbiddenException('No tienes acceso a este recurso (otro tenant/dueño).');
  }
}

// Brigadas: tenant por orgId; legacy por veterinarioIds[].
export function puedeAccederBrigada(
  user: AuthUser,
  doc: { orgId?: string; veterinarioIds?: string[] } & Partial<RuntimeResourceScope>,
): boolean {
  const ctx = resolveMembershipContext(user);
  if (ctx.mode === 'v2') return canAccessRuntimeResource(user, doc);
  if (esSuperadmin(user)) return true;
  if (user.orgId && doc.orgId) {
    return user.orgId === doc.orgId;
  }
  const vIds = Array.isArray(doc.veterinarioIds) ? doc.veterinarioIds : [];
  return vIds.includes(user.uid);
}

export function assertAccesoBrigada(
  user: AuthUser,
  doc: { orgId?: string; veterinarioIds?: string[] } & Partial<RuntimeResourceScope>,
): void {
  if (!puedeAccederBrigada(user, doc)) {
    throw new ForbiddenException('No tienes acceso a este recurso (otro tenant/dueño).');
  }
}

export function assertTenantRuntime(user: AuthUser): void {
  const ctx = resolveMembershipContext(user);
  if (ctx.mode === 'v2' && ctx.role === 'superadmin') {
    throw new ForbiddenException('Este endpoint tenant requiere un contexto clinico explicito.');
  }
}

export function assertOperacionClinica(
  user: AuthUser,
  resource?: Partial<RuntimeResourceScope>,
): void {
  const ctx = resolveMembershipContext(user);

  if (ctx.mode === 'v2') {
    if (ctx.role === 'veterinario') return;

    if (ctx.role === 'admin_veterinaria') {
      if (!isNonEmpty(ctx.veterinariaId) || !isNonEmpty(ctx.accountId)) {
        throw new ForbiddenException('Admin veterinaria requiere veterinariaId y accountId para operar clinica.');
      }

      if (resource) {
        const sameVeterinaria = resource.veterinariaId === ctx.veterinariaId;
        const sameAccount = resource.accountId === ctx.accountId;
        if (!sameVeterinaria || !sameAccount) {
          throw new ForbiddenException('No puedes operar recursos clinicos fuera de tu veterinaria.');
        }
      }

      return;
    }

    throw new ForbiddenException('Tu rol no permite operar flujos clinicos tenant.');
  }

  if (user.rol === 'vet') return;
  throw new ForbiddenException('Tu rol no permite operar flujos clinicos tenant.');
}

export function scopeClinicoParaCrearV2(
  user: AuthUser,
  parentScope?: Partial<RuntimeResourceScope>,
): Partial<RuntimeResourceScope> {
  assertTenantRuntime(user);
  try {
    return clinicalScopeForCreate(user, parentScope);
  } catch {
    throw new ForbiddenException('Contexto V2 invalido para escribir este recurso.');
  }
}

export function filtroTenantRuntime(user: AuthUser) {
  assertTenantRuntime(user);
  return runtimeTenantFilter(user);
}

// Clave de particion para contadores/recursos: preferimos orgId; si no hay, usamos
// el vet como tenant implicito para no caer todos en el mismo doc global.
export function particionTenant(user: AuthUser, doc?: { orgId?: string; veterinarioId?: string }): string {
  const ctx = resolveMembershipContext(user);
  if (ctx.mode === 'v2' && ctx.accountId && ctx.role !== 'superadmin') {
    return ctx.accountId;
  }
  const orgId = user.orgId ?? doc?.orgId;
  if (orgId) return orgId;
  const vet = doc?.veterinarioId ?? user.uid;
  return `vet_${vet}`;
}

function isNonEmpty(value?: string): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
