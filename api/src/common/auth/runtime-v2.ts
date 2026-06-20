import type {
  AccountTypeV2,
  AuthUser,
  PlanOwnerTypeV2,
  Rol,
  RolV2,
  VinculoTipoV2,
} from './auth-user.interface';
import {
  canAccessResourceV2,
  isAuthUserV2,
  type PlanScopeV2,
  type ResourceScopeV2,
  validateClinicalScopeV2,
} from './access-v2';

export interface MembershipRuntimeContextV2 {
  mode: 'v2' | 'legacy';
  uid: string;
  email?: string;
  orgId?: string;
  legacyRol?: Rol;
  role?: RolV2;
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  membershipId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  vinculoTipo?: VinculoTipoV2;
}

export interface ClinicalScopeFieldsV2 extends ResourceScopeV2, PlanScopeV2 {
  membershipId?: string;
  legacyOrgId?: string;
  orgId?: string;
}

export interface RuntimeTenantFilter {
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  orgId?: string;
  uid?: string;
}

export type RuntimeResourceScope = ClinicalScopeFieldsV2 & {
  veterinarioIds?: string[];
  assignedVeterinarioIds?: string[];
  assignedMembershipIds?: string[];
};

export function resolveMembershipContext(user: AuthUser): MembershipRuntimeContextV2 {
  if (isAuthUserV2(user)) {
    return stripUndefined({
      mode: 'v2',
      uid: user.uid,
      email: user.email,
      orgId: user.orgId,
      legacyRol: user.rol,
      role: user.role,
      accountType: user.accountType,
      accountId: user.accountId,
      entidadId: user.entidadId,
      veterinariaId: user.veterinariaId,
      membershipId: user.membershipId,
      planOwnerType: user.planOwnerType,
      planOwnerId: user.planOwnerId,
      vinculoTipo: user.vinculoTipo,
    }) as unknown as MembershipRuntimeContextV2;
  }

  return stripUndefined({
    mode: 'legacy',
    uid: user.uid,
    email: user.email,
    orgId: user.orgId,
    legacyRol: user.rol,
  }) as unknown as MembershipRuntimeContextV2;
}

export function isTenantRuntimeV2Context(
  ctx: MembershipRuntimeContextV2,
): ctx is MembershipRuntimeContextV2 & { mode: 'v2'; role: Exclude<RolV2, 'superadmin'> } {
  return ctx.mode === 'v2' && ctx.role !== 'superadmin';
}

export function hasAnyScopeV2(scope: Partial<RuntimeResourceScope>): boolean {
  return Boolean(
    scope.accountId ||
      scope.accountType ||
      scope.entidadId ||
      scope.veterinariaId ||
      scope.planOwnerId ||
      scope.planOwnerType ||
      scope.membershipId,
  );
}

export function hasCompleteClinicalScopeV2(
  scope: Partial<RuntimeResourceScope>,
): scope is ClinicalScopeFieldsV2 & { accountId: string; accountType: AccountTypeV2 } {
  return isNonEmpty(scope.accountId) && typeof scope.accountType === 'string';
}

export function runtimeTenantFilter(user: AuthUser): RuntimeTenantFilter {
  const ctx = resolveMembershipContext(user);
  if (!isTenantRuntimeV2Context(ctx)) {
    return legacyTenantFilter(user);
  }

  if (ctx.role === 'admin_entidad' && isNonEmpty(ctx.entidadId)) {
    return stripUndefined({ entidadId: ctx.entidadId, orgId: ctx.orgId }) as RuntimeTenantFilter;
  }

  if (ctx.role === 'admin_veterinaria' && isNonEmpty(ctx.veterinariaId)) {
    return stripUndefined({
      veterinariaId: ctx.veterinariaId,
      accountId: ctx.accountId,
      orgId: ctx.orgId,
    }) as RuntimeTenantFilter;
  }

  if (isNonEmpty(ctx.accountId)) {
    return stripUndefined({ accountId: ctx.accountId, orgId: ctx.orgId, uid: ctx.uid }) as RuntimeTenantFilter;
  }

  return legacyTenantFilter(user);
}

export function clinicalScopeForCreate(
  user: AuthUser,
  parentScope?: Partial<RuntimeResourceScope>,
): Partial<ClinicalScopeFieldsV2> {
  const ctx = resolveMembershipContext(user);
  if (!isTenantRuntimeV2Context(ctx)) return {};

  const parent = hasCompleteClinicalScopeV2(parentScope ?? {}) ? parentScope : undefined;
  const scope = stripUndefined({
    accountType: parent?.accountType ?? ctx.accountType,
    accountId: parent?.accountId ?? ctx.accountId,
    entidadId: parent?.entidadId ?? ctx.entidadId,
    veterinariaId: parent?.veterinariaId ?? ctx.veterinariaId,
    planOwnerType: parent?.planOwnerType ?? ctx.planOwnerType,
    planOwnerId: parent?.planOwnerId ?? ctx.planOwnerId,
  }) as ClinicalScopeFieldsV2;

  const validation = validateClinicalScopeV2(scope);
  if (!isNonEmpty(scope.planOwnerId)) validation.errors.push('planOwnerId_required');
  if (!scope.planOwnerType) validation.errors.push('planOwnerType_required');
  if (validation.errors.length > 0) {
    throw new Error(`Contexto V2 invalido: ${validation.errors.join(',')}`);
  }

  return stripUndefined({
    ...scope,
    membershipId: ctx.membershipId,
    legacyOrgId: ctx.orgId,
  }) as Partial<ClinicalScopeFieldsV2>;
}

export function canAccessRuntimeResource(
  user: AuthUser,
  resource: Partial<RuntimeResourceScope>,
): boolean {
  const ctx = resolveMembershipContext(user);
  if (ctx.mode === 'v2' && ctx.role === 'superadmin') return false;
  if (ctx.mode === 'v2' && hasAnyScopeV2(resource)) {
    return canAccessResourceV2(user, {
      accountType: resource.accountType,
      accountId: resource.accountId,
      entidadId: resource.entidadId,
      veterinariaId: resource.veterinariaId,
      veterinarioId: resource.veterinarioId,
      assignedVeterinarioIds: resource.assignedVeterinarioIds ?? resource.veterinarioIds,
      assignedMembershipIds: resource.assignedMembershipIds,
    });
  }
  return legacyCanAccess(user, resource);
}

export function runtimeScopeFromRecord(data: Record<string, unknown>): RuntimeResourceScope {
  return stripUndefined({
    orgId: str(data.orgId),
    legacyOrgId: str(data.legacyOrgId),
    veterinarioId: str(data.veterinarioId),
    accountType: parseAccountType(data.accountType),
    accountId: str(data.accountId),
    entidadId: str(data.entidadId),
    veterinariaId: str(data.veterinariaId),
    planOwnerType: parsePlanOwnerType(data.planOwnerType),
    planOwnerId: str(data.planOwnerId),
    membershipId: str(data.membershipId),
    veterinarioIds: stringArray(data.veterinarioIds),
    assignedVeterinarioIds: stringArray(data.assignedVeterinarioIds),
    assignedMembershipIds: stringArray(data.assignedMembershipIds),
  }) as RuntimeResourceScope;
}

function legacyTenantFilter(user: AuthUser): RuntimeTenantFilter {
  return user.orgId ? { orgId: user.orgId } : { uid: user.uid };
}

function legacyCanAccess(user: AuthUser, doc: Partial<RuntimeResourceScope>): boolean {
  if (user.rol === 'superadmin') return true;
  if (user.orgId && doc.orgId) return user.orgId === doc.orgId;
  return isNonEmpty(doc.veterinarioId) && doc.veterinarioId === user.uid;
}

function parseAccountType(value: unknown): AccountTypeV2 | undefined {
  return value === 'vet_individual' || value === 'veterinaria' || value === 'entidad'
    ? value
    : undefined;
}

function parsePlanOwnerType(value: unknown): PlanOwnerTypeV2 | undefined {
  return value === 'vet' || value === 'veterinaria' || value === 'entidad' ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isNonEmpty(value?: string): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}
