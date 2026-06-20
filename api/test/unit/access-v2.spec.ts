import {
  assertScopeAccessV2,
  canAccessResourceV2,
  canOperatePlanV2,
  isAuthUserV2,
  validateClinicalScopeV2,
} from '../../src/common/auth/access-v2';
import { ROLES_HUMANOS_V2, type AuthUser, type AuthUserV2 } from '../../src/common/auth/auth-user.interface';

describe('access-v2 (RBAC/tenant jerarquico Fase 0)', () => {
  it('R121: RolV2 humano canonico solo contiene los roles del PDF', () => {
    expect(ROLES_HUMANOS_V2).toEqual([
      'superadmin',
      'admin_entidad',
      'admin_veterinaria',
      'veterinario',
    ]);
    expect(ROLES_HUMANOS_V2).not.toContain('asistente');
    expect(ROLES_HUMANOS_V2).not.toContain('sistema');
  });

  it('R121/R122: asistente y sistema no pasan como usuario V2', () => {
    expect(isAuthUserV2({ uid: 'legacy-asistente', v: 2, role: 'asistente' } as unknown as AuthUser)).toBe(false);
    expect(isAuthUserV2({ uid: 'job', v: 2, role: 'sistema' } as unknown as AuthUser)).toBe(false);
  });

  const adminEntidadA: AuthUserV2 = {
    uid: 'admin-ent-a',
    v: 2,
    role: 'admin_entidad',
    accountType: 'entidad',
    accountId: 'ent-a',
    entidadId: 'ent-a',
    membershipId: 'm-admin-ent-a',
    planOwnerType: 'entidad',
    planOwnerId: 'ent-a',
  };

  const adminVeterinariaA: AuthUserV2 = {
    uid: 'admin-vet-a',
    v: 2,
    role: 'admin_veterinaria',
    accountType: 'veterinaria',
    accountId: 'vet-a',
    entidadId: 'ent-a',
    veterinariaId: 'vet-a',
    membershipId: 'm-admin-vet-a',
    planOwnerType: 'entidad',
    planOwnerId: 'ent-a',
  };

  const freelanceEntidadA: AuthUserV2 = {
    uid: 'freelance-a',
    v: 2,
    role: 'veterinario',
    accountType: 'entidad',
    accountId: 'ent-a',
    entidadId: 'ent-a',
    membershipId: 'm-free-a',
    planOwnerType: 'entidad',
    planOwnerId: 'ent-a',
    vinculoTipo: 'freelance',
  };

  const vetVeterinariaA: AuthUserV2 = {
    uid: 'vet-a',
    v: 2,
    role: 'veterinario',
    accountType: 'veterinaria',
    accountId: 'vet-a',
    entidadId: 'ent-a',
    veterinariaId: 'vet-a',
    membershipId: 'm-vet-a',
    planOwnerType: 'entidad',
    planOwnerId: 'ent-a',
    vinculoTipo: 'staff',
  };

  const recursoVeterinariaA = {
    accountType: 'veterinaria' as const,
    accountId: 'vet-a',
    entidadId: 'ent-a',
    veterinariaId: 'vet-a',
    veterinarioId: 'vet-a',
  };

  it('admin_entidad de entidad A no accede a entidad B', () => {
    expect(
      canAccessResourceV2(adminEntidadA, {
        accountType: 'veterinaria',
        accountId: 'vet-b',
        entidadId: 'ent-b',
        veterinariaId: 'vet-b',
      }),
    ).toBe(false);
  });

  it('admin_veterinaria de veterinaria A no accede a veterinaria B', () => {
    expect(
      canAccessResourceV2(adminVeterinariaA, {
        accountType: 'veterinaria',
        accountId: 'vet-b',
        entidadId: 'ent-a',
        veterinariaId: 'vet-b',
      }),
    ).toBe(false);
  });

  it('admin_veterinaria no opera un plan cuyo owner es la entidad', () => {
    expect(
      canOperatePlanV2(adminVeterinariaA, {
        planOwnerType: 'entidad',
        planOwnerId: 'ent-a',
        entidadId: 'ent-a',
      }),
    ).toBe(false);
  });

  it('admin_veterinaria opera plan solo cuando la veterinaria es planOwner', () => {
    const adminVetPlanPropio: AuthUserV2 = {
      ...adminVeterinariaA,
      planOwnerType: 'veterinaria',
      planOwnerId: 'vet-a',
    };

    expect(
      canOperatePlanV2(adminVetPlanPropio, {
        planOwnerType: 'veterinaria',
        planOwnerId: 'vet-a',
        veterinariaId: 'vet-a',
      }),
    ).toBe(true);
    expect(
      canOperatePlanV2(adminVetPlanPropio, {
        planOwnerType: 'veterinaria',
        planOwnerId: 'vet-b',
        veterinariaId: 'vet-b',
      }),
    ).toBe(false);
  });

  it('admin_veterinaria ve su veterinaria pero no sede hermana', () => {
    expect(canAccessResourceV2(adminVeterinariaA, recursoVeterinariaA)).toBe(true);
    expect(
      canAccessResourceV2(adminVeterinariaA, {
        accountType: 'veterinaria',
        accountId: 'vet-hermana',
        entidadId: 'ent-a',
        veterinariaId: 'vet-hermana',
      }),
    ).toBe(false);
  });

  it('veterinario freelance de entidad no ve pacientes de veterinaria sin asignacion explicita', () => {
    expect(canAccessResourceV2(freelanceEntidadA, recursoVeterinariaA)).toBe(false);
  });

  it('veterinario freelance de entidad puede ver pacientes de veterinaria con asignacion explicita', () => {
    expect(
      canAccessResourceV2(freelanceEntidadA, {
        ...recursoVeterinariaA,
        assignedVeterinarioIds: ['freelance-a'],
      }),
    ).toBe(true);
  });

  it('veterinario de veterinaria no ve pacientes freelance directos de la entidad sin asignacion explicita', () => {
    expect(
      canAccessResourceV2(vetVeterinariaA, {
        accountType: 'entidad',
        accountId: 'ent-a',
        entidadId: 'ent-a',
        veterinarioId: 'freelance-a',
      }),
    ).toBe(false);
  });

  it('veterinario de veterinaria puede ver pacientes freelance directos con asignacion explicita', () => {
    expect(
      canAccessResourceV2(vetVeterinariaA, {
        accountType: 'entidad',
        accountId: 'ent-a',
        entidadId: 'ent-a',
        veterinarioId: 'freelance-a',
        assignedMembershipIds: ['m-vet-a'],
      }),
    ).toBe(true);
  });

  it('veterinarioId no concede ownership si el paciente pertenece a otra cuenta', () => {
    const exVetCuentaPersonal: AuthUserV2 = {
      uid: 'vet-retirado',
      v: 2,
      role: 'veterinario',
      accountType: 'vet_individual',
      accountId: 'vet_vet-retirado',
      membershipId: 'm-vet-retirado',
      planOwnerType: 'vet',
      planOwnerId: 'vet_vet-retirado',
    };

    expect(
      canAccessResourceV2(exVetCuentaPersonal, {
        accountType: 'veterinaria',
        accountId: 'vet-a',
        entidadId: 'ent-a',
        veterinariaId: 'vet-a',
        veterinarioId: 'vet-retirado',
      }),
    ).toBe(false);
  });

  it('documento clinico nuevo sin accountId se rechaza', () => {
    const result = validateClinicalScopeV2({
      accountType: 'veterinaria',
      veterinariaId: 'vet-a',
      planOwnerType: 'veterinaria',
      planOwnerId: 'vet-a',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('accountId_required');
  });

  it('documento con accountId/veterinariaId inconsistente se rechaza', () => {
    const result = validateClinicalScopeV2({
      accountType: 'veterinaria',
      accountId: 'vet-a',
      veterinariaId: 'vet-b',
      entidadId: 'ent-a',
      planOwnerType: 'veterinaria',
      planOwnerId: 'vet-a',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('veterinaria_accountId_mismatch');
  });

  it('documento de cuenta entidad con entidadId/veterinariaId inconsistente se rechaza', () => {
    const result = validateClinicalScopeV2({
      accountType: 'entidad',
      accountId: 'ent-a',
      entidadId: 'ent-b',
      veterinariaId: 'vet-a',
      planOwnerType: 'entidad',
      planOwnerId: 'ent-a',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining(['entidad_accountId_mismatch', 'entidad_account_cannot_have_veterinariaId']),
    );
  });

  it('claims legacy admin sin mapping V2 no conceden permisos V2', () => {
    const legacyAdmin: AuthUser = { uid: 'legacy-admin', orgId: 'org-a', rol: 'admin' };

    expect(canAccessResourceV2(legacyAdmin, recursoVeterinariaA)).toBe(false);
    expect(
      canOperatePlanV2(legacyAdmin, {
        planOwnerType: 'entidad',
        planOwnerId: 'ent-a',
      }),
    ).toBe(false);
  });

  it('superadmin no pasa accidentalmente por endpoints tenant normales sin intencion explicita', () => {
    const superadmin: AuthUserV2 = { uid: 'root', v: 2, role: 'superadmin' };

    expect(canAccessResourceV2(superadmin, recursoVeterinariaA)).toBe(false);
    expect(canAccessResourceV2(superadmin, recursoVeterinariaA, { allowSuperadmin: true })).toBe(
      true,
    );
  });

  it('assertScopeAccessV2 falla cerrado con otro scope', () => {
    expect(() =>
      assertScopeAccessV2(adminVeterinariaA, {
        accountType: 'veterinaria',
        accountId: 'vet-b',
        entidadId: 'ent-a',
        veterinariaId: 'vet-b',
      }),
    ).toThrow('No tienes acceso V2');
  });
});
