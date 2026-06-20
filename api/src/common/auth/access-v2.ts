import { ROLES_HUMANOS_V2 } from './auth-user.interface';
import type {
  AccountTypeV2,
  AuthUser,
  AuthUserV2,
  PlanOwnerTypeV2,
  RolV2,
} from './auth-user.interface';

const ROLES_V2: ReadonlySet<RolV2> = new Set(ROLES_HUMANOS_V2);

export interface ResourceScopeV2 {
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  veterinarioId?: string;
  assignedVeterinarioIds?: string[];
  assignedMembershipIds?: string[];
}

export interface PlanScopeV2 {
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  entidadId?: string;
  veterinariaId?: string;
}

export interface AccessV2Options {
  allowSuperadmin?: boolean;
}

export interface ClinicalScopeValidation {
  ok: boolean;
  errors: string[];
}

type MaybeV2User = AuthUser | AuthUserV2;

export function isAuthUserV2(user: MaybeV2User): user is AuthUserV2 {
  const candidate = user as Partial<AuthUserV2>;
  return candidate.v === 2 && typeof candidate.role === 'string' && ROLES_V2.has(candidate.role);
}

export function canAccessResourceV2(
  user: MaybeV2User,
  resource: ResourceScopeV2,
  options: AccessV2Options = {},
): boolean {
  if (!isAuthUserV2(user)) return false;

  if (user.role === 'superadmin') return options.allowSuperadmin === true;

  if (!hasClinicalAccount(resource)) return false;

  if (user.role === 'admin_entidad') {
    return sameNonEmpty(user.entidadId, resource.entidadId);
  }

  if (user.role === 'admin_veterinaria') {
    return (
      sameNonEmpty(user.veterinariaId, resource.veterinariaId) &&
      sameNonEmpty(user.accountId, resource.accountId)
    );
  }

  if (user.role === 'veterinario') {
    if (sameNonEmpty(user.accountId, resource.accountId)) return true;
    return hasExplicitAssignment(user, resource) && sharesHierarchy(user, resource);
  }

  return false;
}

export function canOperatePlanV2(
  user: MaybeV2User,
  plan: PlanScopeV2,
  options: AccessV2Options = {},
): boolean {
  if (!isAuthUserV2(user)) return false;

  if (user.role === 'superadmin') return options.allowSuperadmin === true;

  if (!isNonEmpty(plan.planOwnerId) || !plan.planOwnerType) return false;

  if (user.role === 'admin_entidad') {
    return plan.planOwnerType === 'entidad' && sameNonEmpty(user.entidadId, plan.planOwnerId);
  }

  if (user.role === 'admin_veterinaria') {
    return (
      plan.planOwnerType === 'veterinaria' &&
      sameNonEmpty(user.veterinariaId, plan.planOwnerId)
    );
  }

  if (user.role === 'veterinario') {
    return (
      user.accountType === 'vet_individual' &&
      plan.planOwnerType === 'vet' &&
      sameNonEmpty(user.planOwnerId, plan.planOwnerId)
    );
  }

  return false;
}

export function validateClinicalScopeV2(scope: ResourceScopeV2 & PlanScopeV2): ClinicalScopeValidation {
  const errors: string[] = [];

  if (!isNonEmpty(scope.accountId)) errors.push('accountId_required');
  if (!scope.accountType) errors.push('accountType_required');

  if (scope.accountType === 'vet_individual') {
    if (isNonEmpty(scope.entidadId)) errors.push('vet_individual_cannot_have_entidadId');
    if (isNonEmpty(scope.veterinariaId)) errors.push('vet_individual_cannot_have_veterinariaId');
    if (scope.planOwnerType && scope.planOwnerType !== 'vet') {
      errors.push('vet_individual_plan_owner_type_mismatch');
    }
    if (isNonEmpty(scope.planOwnerId) && !sameNonEmpty(scope.planOwnerId, scope.accountId)) {
      errors.push('vet_individual_plan_owner_id_mismatch');
    }
  }

  if (scope.accountType === 'veterinaria') {
    if (!isNonEmpty(scope.veterinariaId)) errors.push('veterinariaId_required');
    if (isNonEmpty(scope.accountId) && isNonEmpty(scope.veterinariaId) && scope.accountId !== scope.veterinariaId) {
      errors.push('veterinaria_accountId_mismatch');
    }
    if (scope.planOwnerType === 'entidad' && !isNonEmpty(scope.entidadId)) {
      errors.push('entidadId_required_for_entity_plan_owner');
    }
    if (
      scope.planOwnerType === 'veterinaria' &&
      isNonEmpty(scope.planOwnerId) &&
      !sameNonEmpty(scope.planOwnerId, scope.accountId)
    ) {
      errors.push('veterinaria_plan_owner_id_mismatch');
    }
  }

  if (scope.accountType === 'entidad') {
    if (!isNonEmpty(scope.entidadId)) errors.push('entidadId_required');
    if (isNonEmpty(scope.veterinariaId)) errors.push('entidad_account_cannot_have_veterinariaId');
    if (isNonEmpty(scope.accountId) && isNonEmpty(scope.entidadId) && scope.accountId !== scope.entidadId) {
      errors.push('entidad_accountId_mismatch');
    }
    if (scope.planOwnerType && scope.planOwnerType !== 'entidad') {
      errors.push('entidad_plan_owner_type_mismatch');
    }
    if (isNonEmpty(scope.planOwnerId) && !sameNonEmpty(scope.planOwnerId, scope.accountId)) {
      errors.push('entidad_plan_owner_id_mismatch');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function assertScopeAccessV2(
  user: MaybeV2User,
  resource: ResourceScopeV2,
  options?: AccessV2Options,
): void {
  if (!canAccessResourceV2(user, resource, options)) {
    throw new Error('No tienes acceso V2 a este recurso.');
  }
}

function hasClinicalAccount(resource: ResourceScopeV2): boolean {
  return isNonEmpty(resource.accountId);
}

function hasExplicitAssignment(user: AuthUserV2, resource: ResourceScopeV2): boolean {
  const byVet = Array.isArray(resource.assignedVeterinarioIds)
    ? resource.assignedVeterinarioIds.includes(user.uid)
    : false;
  const byMembership =
    isNonEmpty(user.membershipId) && Array.isArray(resource.assignedMembershipIds)
      ? resource.assignedMembershipIds.includes(user.membershipId)
      : false;

  return byVet || byMembership;
}

function sharesHierarchy(user: AuthUserV2, resource: ResourceScopeV2): boolean {
  return (
    sameNonEmpty(user.entidadId, resource.entidadId) ||
    sameNonEmpty(user.veterinariaId, resource.veterinariaId) ||
    sameNonEmpty(user.accountId, resource.accountId)
  );
}

function sameNonEmpty(a?: string, b?: string): boolean {
  return isNonEmpty(a) && isNonEmpty(b) && a === b;
}

function isNonEmpty(value?: string): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
