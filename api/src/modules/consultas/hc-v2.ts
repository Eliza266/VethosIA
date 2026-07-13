import type { AccountTypeV2 } from '../../common/auth/auth-user.interface';
import { COLLECTIONS, contadorHcDocId } from '../../common/firebase/collections';

export interface HcCounterScopeV2 {
  accountId?: string;
  accountType?: AccountTypeV2;
  entidadId?: string;
  veterinariaId?: string;
}

export interface HcCounterV2 {
  collection: typeof COLLECTIONS.configuracion;
  docId: string;
  path: string;
  accountId: string;
  accountType?: AccountTypeV2;
  entidadId: string | null;
  veterinariaId: string | null;
}

export function resolveHcCounterV2(scope: HcCounterScopeV2): HcCounterV2 {
  if (!isNonEmpty(scope.accountId)) {
    throw new Error('accountId requerido para contador HC V2.');
  }
  if (scope.accountType === 'veterinaria') {
    if (!isNonEmpty(scope.veterinariaId)) {
      throw new Error('veterinariaId requerido para contador HC de veterinaria.');
    }
    if (scope.accountId !== scope.veterinariaId) {
      throw new Error('accountId debe coincidir con veterinariaId para contador HC de veterinaria.');
    }
  }
  if (scope.accountType === 'entidad') {
    if (!isNonEmpty(scope.entidadId)) {
      throw new Error('entidadId requerido para contador HC de entidad.');
    }
    if (scope.accountId !== scope.entidadId) {
      throw new Error('accountId debe coincidir con entidadId para contador HC de entidad.');
    }
  }

  const docId = contadorHcDocId(scope.accountId);
  return {
    collection: COLLECTIONS.configuracion,
    docId,
    path: `${COLLECTIONS.configuracion}/${docId}`,
    accountId: scope.accountId,
    accountType: scope.accountType,
    entidadId: scope.entidadId ?? null,
    veterinariaId: scope.veterinariaId ?? null,
  };
}

export function formatoNumeroHcV2(n: number): string {
  return `HC${String(n).padStart(6, '0')}`;
}

function isNonEmpty(value?: string): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
