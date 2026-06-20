import { ROLES_HUMANOS_V2 } from '../../common/auth/auth-user.interface';
import type {
  AccountTypeV2,
  PlanOwnerTypeV2,
  Rol,
  RolV2,
  VinculoTipoV2,
} from '../../common/auth/auth-user.interface';

export type MembershipRoleV2 = RolV2;

export interface MembershipClaimsV2Input {
  role: MembershipRoleV2;
  accountId?: string;
  accountType?: AccountTypeV2;
  entidadId?: string;
  veterinariaId?: string;
  membershipId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  vinculoTipo?: VinculoTipoV2;
  orgId?: string;
  rol?: Rol;
}

export interface LegacyClaimsSnapshot {
  orgId: string;
  rol: Rol;
}

export interface ClaimsAuthClient {
  setCustomUserClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
  revokeRefreshTokens(uid: string): Promise<void>;
}

export interface ClaimsUpdateResult {
  claims: Record<string, unknown>;
  refreshTokensRevoked: true;
  requiresTokenRefresh: true;
}

const HUMAN_ROLES_V2: ReadonlySet<MembershipRoleV2> = new Set(ROLES_HUMANOS_V2);

export function buildMembershipClaimsV2(input: MembershipClaimsV2Input): Record<string, unknown> {
  if (!HUMAN_ROLES_V2.has(input.role)) {
    throw new Error('Rol V2 invalido para claims de usuario.');
  }
  if (input.role !== 'superadmin' && !isNonEmpty(input.membershipId)) {
    throw new Error('membershipId requerido para contexto V2.');
  }

  return stripUndefined({
    v: 2,
    role: input.role,
    accountId: input.accountId,
    accountType: input.accountType,
    entidadId: input.entidadId,
    veterinariaId: input.veterinariaId,
    membershipId: input.membershipId,
    planOwnerType: input.planOwnerType,
    planOwnerId: input.planOwnerId,
    vinculoTipo: input.vinculoTipo,
    orgId: input.orgId,
    rol: input.rol,
  });
}

export async function applyMembershipClaimsV2(
  auth: ClaimsAuthClient,
  uid: string,
  input: MembershipClaimsV2Input,
): Promise<ClaimsUpdateResult> {
  const claims = buildMembershipClaimsV2(input);
  await auth.setCustomUserClaims(uid, claims);
  await auth.revokeRefreshTokens(uid);
  return { claims, refreshTokensRevoked: true, requiresTokenRefresh: true };
}

export function buildLegacyClaimsRollbackV2(
  currentClaims: Record<string, unknown>,
  snapshot: LegacyClaimsSnapshot,
): Record<string, unknown> {
  if (!isNonEmpty(snapshot.orgId) || !isNonEmpty(snapshot.rol)) {
    throw new Error('Snapshot legacy incompleto para rollback de claims.');
  }
  return stripUndefined({
    ...currentClaims,
    orgId: snapshot.orgId,
    rol: snapshot.rol,
  });
}

export async function rollbackLegacyClaimsV2(
  auth: ClaimsAuthClient,
  uid: string,
  currentClaims: Record<string, unknown>,
  snapshot: LegacyClaimsSnapshot,
): Promise<ClaimsUpdateResult> {
  const claims = buildLegacyClaimsRollbackV2(currentClaims, snapshot);
  await auth.setCustomUserClaims(uid, claims);
  await auth.revokeRefreshTokens(uid);
  return { claims, refreshTokensRevoked: true, requiresTokenRefresh: true };
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}

function isNonEmpty(value?: string): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
