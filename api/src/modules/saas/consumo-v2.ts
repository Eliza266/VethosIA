import type { AccountTypeV2, PlanOwnerTypeV2 } from '../../common/auth/auth-user.interface';
import { COLLECTIONS, consumoDocId } from '../../common/firebase/collections';

export interface ConsumoScopeV2 {
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  veterinarioId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
}

export interface ConsumoScopeValidationV2 {
  ok: boolean;
  errors: string[];
}

export interface ConsumoDimensionsV2 {
  accountType: AccountTypeV2;
  accountId: string;
  entidadId: string | null;
  veterinariaId: string | null;
  veterinarioId: string | null;
  planOwnerType: PlanOwnerTypeV2;
  planOwnerId: string;
}

export interface ConsumoPlanOwnerV2 {
  collection: typeof COLLECTIONS.consumos;
  docId: string;
  path: string;
  periodo: string;
  scopeId: string;
  planOwnerType: PlanOwnerTypeV2;
  planOwnerId: string;
  dimensions: ConsumoDimensionsV2;
  write: ConsumoDimensionsV2 & {
    periodo: string;
    scopeId: string;
  };
}

export function validateConsumoScopeV2(scope: ConsumoScopeV2): ConsumoScopeValidationV2 {
  const errors: string[] = [];

  if (!scope.accountType) errors.push('accountType_required');
  if (!isNonEmpty(scope.accountId)) errors.push('accountId_required');
  if (!scope.planOwnerType) errors.push('planOwnerType_required');
  if (!isNonEmpty(scope.planOwnerId)) errors.push('planOwnerId_required');

  if (scope.accountType === 'vet_individual') {
    if (isNonEmpty(scope.entidadId)) errors.push('vet_individual_cannot_have_entidadId');
    if (isNonEmpty(scope.veterinariaId)) errors.push('vet_individual_cannot_have_veterinariaId');
    if (scope.planOwnerType && scope.planOwnerType !== 'vet') {
      errors.push('vet_individual_plan_owner_type_mismatch');
    }
    if (isNonEmpty(scope.accountId) && isNonEmpty(scope.planOwnerId) && scope.accountId !== scope.planOwnerId) {
      errors.push('vet_individual_plan_owner_id_mismatch');
    }
  }

  if (scope.accountType === 'veterinaria') {
    if (!isNonEmpty(scope.veterinariaId)) errors.push('veterinariaId_required');
    if (isNonEmpty(scope.accountId) && isNonEmpty(scope.veterinariaId) && scope.accountId !== scope.veterinariaId) {
      errors.push('veterinaria_accountId_mismatch');
    }

    if (scope.planOwnerType === 'entidad') {
      if (!isNonEmpty(scope.entidadId)) errors.push('entidadId_required_for_entity_plan_owner');
      if (isNonEmpty(scope.planOwnerId) && isNonEmpty(scope.entidadId) && scope.planOwnerId !== scope.entidadId) {
        errors.push('entidad_plan_owner_id_mismatch');
      }
    }

    if (
      scope.planOwnerType === 'veterinaria' &&
      isNonEmpty(scope.planOwnerId) &&
      isNonEmpty(scope.veterinariaId) &&
      scope.planOwnerId !== scope.veterinariaId
    ) {
      errors.push('veterinaria_plan_owner_id_mismatch');
    }

    if (scope.planOwnerType === 'vet') {
      errors.push('veterinaria_plan_owner_type_mismatch');
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
    if (isNonEmpty(scope.planOwnerId) && isNonEmpty(scope.entidadId) && scope.planOwnerId !== scope.entidadId) {
      errors.push('entidad_plan_owner_id_mismatch');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function resolveConsumoPlanOwnerV2(scope: ConsumoScopeV2, periodo: string): ConsumoPlanOwnerV2 {
  const validation = validateConsumoScopeV2(scope);
  if (!validation.ok) {
    throw new Error(`Consumo V2 scope invalido: ${validation.errors.join(', ')}`);
  }
  if (!isNonEmpty(periodo)) {
    throw new Error('Consumo V2 periodo requerido.');
  }

  const accountType = scope.accountType as AccountTypeV2;
  const accountId = scope.accountId as string;
  const planOwnerType = scope.planOwnerType as PlanOwnerTypeV2;
  const planOwnerId = scope.planOwnerId as string;
  const docId = consumoDocId(planOwnerId, periodo);
  const dimensions: ConsumoDimensionsV2 = {
    accountType,
    accountId,
    entidadId: scope.entidadId ?? null,
    veterinariaId: scope.veterinariaId ?? null,
    veterinarioId: scope.veterinarioId ?? null,
    planOwnerType,
    planOwnerId,
  };

  return {
    collection: COLLECTIONS.consumos,
    docId,
    path: `${COLLECTIONS.consumos}/${docId}`,
    periodo,
    scopeId: planOwnerId,
    planOwnerType,
    planOwnerId,
    dimensions,
    write: {
      ...dimensions,
      periodo,
      scopeId: planOwnerId,
    },
  };
}

function isNonEmpty(value?: string): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
