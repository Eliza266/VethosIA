import type { AuthUser, PlanOwnerTypeV2 } from '../../common/auth/auth-user.interface';
import { canOperatePlanV2, isAuthUserV2 } from '../../common/auth/access-v2';
import type { SuscripcionDoc } from './plan.types';

export interface PlanOwnerScope {
  planOwnerType: PlanOwnerTypeV2;
  planOwnerId: string;
}

/** Resuelve planOwner desde suscripcion (referencia de checkout/webhook). */
export function planOwnerFromSubscription(
  sub: Pick<SuscripcionDoc, 'orgId' | 'veterinarioId' | 'planOwnerType' | 'planOwnerId'>,
): PlanOwnerScope {
  if (sub.planOwnerId && sub.planOwnerType) {
    return { planOwnerType: sub.planOwnerType, planOwnerId: sub.planOwnerId };
  }
  if (sub.orgId) {
    return { planOwnerType: 'entidad', planOwnerId: sub.orgId };
  }
  const uid = sub.veterinarioId ?? '';
  return { planOwnerType: 'vet', planOwnerId: uid.startsWith('vet_') ? uid : `vet_${uid}` };
}

/** Resuelve planOwner desde AuthUser (servidor). No confiar en body del cliente. */
export function planOwnerFromUser(user: AuthUser): PlanOwnerScope | null {
  if (user.planOwnerId && user.planOwnerType) {
    return { planOwnerType: user.planOwnerType, planOwnerId: user.planOwnerId };
  }
  if (user.orgId) {
    return { planOwnerType: 'entidad', planOwnerId: user.orgId };
  }
  if (user.v === 2 && user.accountType === 'veterinaria' && user.veterinariaId) {
    return { planOwnerType: 'veterinaria', planOwnerId: user.veterinariaId };
  }
  if (!user.orgId && user.uid) {
    return { planOwnerType: 'vet', planOwnerId: `vet_${user.uid}` };
  }
  return null;
}

export function puedeConfigurarPagos(user: AuthUser, scope: PlanOwnerScope): boolean {
  if (canOperatePlanV2(user, scope)) return true;
  if (isAuthUserV2(user)) return false;
  if (user.rol === 'admin' && scope.planOwnerType === 'entidad' && user.orgId === scope.planOwnerId) {
    return true;
  }
  if (
    user.rol === 'vet' &&
    scope.planOwnerType === 'vet' &&
    scope.planOwnerId === `vet_${user.uid}`
  ) {
    return true;
  }
  return false;
}
