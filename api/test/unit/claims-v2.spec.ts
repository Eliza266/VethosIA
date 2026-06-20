import {
  applyMembershipClaimsV2,
  buildLegacyClaimsRollbackV2,
  buildMembershipClaimsV2,
  ClaimsAuthClient,
  rollbackLegacyClaimsV2,
} from '../../src/modules/tenant/claims-v2';

function fakeAuth() {
  const calls: string[] = [];
  const auth: ClaimsAuthClient = {
    setCustomUserClaims: jest.fn(async () => {
      calls.push('setCustomUserClaims');
    }),
    revokeRefreshTokens: jest.fn(async () => {
      calls.push('revokeRefreshTokens');
    }),
  };
  return { auth, calls };
}

describe('claims-v2 membership updates and rollback', () => {
  it('construye claims V2 por whitelist con legacy orgId/rol compatible', () => {
    const claims = buildMembershipClaimsV2({
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_1',
      membershipId: 'm_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      vinculoTipo: 'staff',
      orgId: 'org_legacy',
      rol: 'admin',
    });

    expect(claims).toEqual({
      v: 2,
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_1',
      membershipId: 'm_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      vinculoTipo: 'staff',
      orgId: 'org_legacy',
      rol: 'admin',
    });
  });

  it('R90: cambio de membresia actualiza custom claims, revoca refresh tokens y exige refrescar token', async () => {
    const { auth, calls } = fakeAuth();
    const result = await applyMembershipClaimsV2(auth, 'uid_1', {
      role: 'veterinario',
      accountType: 'veterinaria',
      accountId: 'vetclin_new',
      entidadId: 'ent_new',
      veterinariaId: 'vetclin_new',
      membershipId: 'm_new',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_new',
      orgId: 'org_new',
      rol: 'vet',
    });

    expect(auth.setCustomUserClaims).toHaveBeenCalledWith(
      'uid_1',
      expect.objectContaining({
        v: 2,
        role: 'veterinario',
        accountId: 'vetclin_new',
        membershipId: 'm_new',
        planOwnerId: 'ent_new',
        orgId: 'org_new',
        rol: 'vet',
      }),
    );
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('uid_1');
    expect(calls).toEqual(['setCustomUserClaims', 'revokeRefreshTokens']);
    expect(result).toMatchObject({
      refreshTokensRevoked: true,
      requiresTokenRefresh: true,
    });
  });

  it('R90: no conserva claims viejos peligrosos al aplicar un nuevo contexto', async () => {
    const { auth } = fakeAuth();
    await applyMembershipClaimsV2(auth, 'uid_1', {
      role: 'admin_entidad',
      accountType: 'entidad',
      accountId: 'ent_new',
      entidadId: 'ent_new',
      membershipId: 'm_new',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_new',
      orgId: 'org_new',
      rol: 'admin',
    });

    const [, claims] = (auth.setCustomUserClaims as jest.Mock).mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(claims).not.toMatchObject({
      role: 'admin_veterinaria',
      accountId: 'vetclin_old',
      membershipId: 'm_old',
      planOwnerId: 'vetclin_old',
      orgId: 'org_old',
    });
    expect(claims).toMatchObject({
      role: 'admin_entidad',
      accountId: 'ent_new',
      membershipId: 'm_new',
      planOwnerId: 'ent_new',
      orgId: 'org_new',
    });
  });

  it('requiere membershipId para roles V2 tenant normales', () => {
    expect(() =>
      buildMembershipClaimsV2({
        role: 'veterinario',
        accountType: 'veterinaria',
        accountId: 'vetclin_1',
      }),
    ).toThrow(/membershipId/);
  });

  it('R121/R122: no construye claims humanos con asistente ni sistema', () => {
    expect(() =>
      buildMembershipClaimsV2({
        role: 'asistente' as never,
        accountType: 'veterinaria',
        accountId: 'vetclin_1',
        membershipId: 'm_legacy',
      }),
    ).toThrow('Rol V2 invalido');
    expect(() =>
      buildMembershipClaimsV2({
        role: 'sistema' as never,
        accountType: 'entidad',
        accountId: 'ent_1',
        membershipId: 'm_system',
      }),
    ).toThrow('Rol V2 invalido');
  });

  it('R95: rollback restaura orgId/rol legacy sin borrar campos V2', () => {
    const current = {
      v: 2,
      role: 'admin_veterinaria',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_1',
      membershipId: 'm_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      orgId: 'org_incorrecta',
      rol: 'admin',
    };

    const claims = buildLegacyClaimsRollbackV2(current, {
      orgId: 'org_legacy_ok',
      rol: 'vet',
    });

    expect(claims).toMatchObject({
      orgId: 'org_legacy_ok',
      rol: 'vet',
      v: 2,
      role: 'admin_veterinaria',
      accountId: 'vetclin_1',
      membershipId: 'm_1',
      planOwnerId: 'ent_1',
    });
  });

  it('R95: rollback aplica claims legacy restaurados y revoca refresh tokens', async () => {
    const { auth, calls } = fakeAuth();
    const result = await rollbackLegacyClaimsV2(
      auth,
      'uid_1',
      {
        v: 2,
        role: 'admin_entidad',
        accountId: 'ent_1',
        membershipId: 'm_1',
        planOwnerId: 'ent_1',
        orgId: 'org_bad',
        rol: 'admin',
      },
      { orgId: 'org_good', rol: 'vet' },
    );

    expect(auth.setCustomUserClaims).toHaveBeenCalledWith(
      'uid_1',
      expect.objectContaining({
        orgId: 'org_good',
        rol: 'vet',
        role: 'admin_entidad',
        accountId: 'ent_1',
        membershipId: 'm_1',
        planOwnerId: 'ent_1',
      }),
    );
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('uid_1');
    expect(calls).toEqual(['setCustomUserClaims', 'revokeRefreshTokens']);
    expect(result.requiresTokenRefresh).toBe(true);
  });
});
