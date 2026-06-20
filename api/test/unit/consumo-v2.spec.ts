import {
  resolveConsumoPlanOwnerV2,
  validateConsumoScopeV2,
} from '../../src/modules/saas/consumo-v2';

const PERIODO = '2026-06';

describe('consumo-v2 planOwnerId', () => {
  it('R86: vet independiente consume contra consumos/{vet_uid}_{periodo}', () => {
    const consumo = resolveConsumoPlanOwnerV2(
      {
        accountType: 'vet_individual',
        accountId: 'vet_u9',
        veterinarioId: 'u9',
        planOwnerType: 'vet',
        planOwnerId: 'vet_u9',
      },
      PERIODO,
    );

    expect(consumo.docId).toBe('vet_u9_2026-06');
    expect(consumo.path).toBe('consumos/vet_u9_2026-06');
    expect(consumo.scopeId).toBe('vet_u9');
    expect(consumo.write).toMatchObject({
      periodo: PERIODO,
      scopeId: 'vet_u9',
      accountType: 'vet_individual',
      accountId: 'vet_u9',
      entidadId: null,
      veterinariaId: null,
      veterinarioId: 'u9',
      planOwnerType: 'vet',
      planOwnerId: 'vet_u9',
    });
  });

  it('R87: veterinaria independiente consume contra consumos/{veterinariaId}_{periodo}', () => {
    const consumo = resolveConsumoPlanOwnerV2(
      {
        accountType: 'veterinaria',
        accountId: 'vetclin_1',
        veterinariaId: 'vetclin_1',
        veterinarioId: 'u-vet-1',
        planOwnerType: 'veterinaria',
        planOwnerId: 'vetclin_1',
      },
      PERIODO,
    );

    expect(consumo.docId).toBe('vetclin_1_2026-06');
    expect(consumo.scopeId).toBe('vetclin_1');
    expect(consumo.write).toMatchObject({
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      entidadId: null,
      veterinariaId: 'vetclin_1',
      veterinarioId: 'u-vet-1',
      planOwnerType: 'veterinaria',
      planOwnerId: 'vetclin_1',
    });
  });

  it('R88: veterinaria bajo entidad consume contra consumos/{entidadId}_{periodo} y conserva dimensiones', () => {
    const consumo = resolveConsumoPlanOwnerV2(
      {
        accountType: 'veterinaria',
        accountId: 'vetclin_2',
        entidadId: 'ent_1',
        veterinariaId: 'vetclin_2',
        veterinarioId: 'u-vet-2',
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
      },
      PERIODO,
    );

    expect(consumo.docId).toBe('ent_1_2026-06');
    expect(consumo.path).toBe('consumos/ent_1_2026-06');
    expect(consumo.scopeId).toBe('ent_1');
    expect(consumo.write).toMatchObject({
      accountType: 'veterinaria',
      accountId: 'vetclin_2',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_2',
      veterinarioId: 'u-vet-2',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    });
  });

  it('rechaza planOwnerType=entidad sin entidadId', () => {
    const result = validateConsumoScopeV2({
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      veterinariaId: 'vetclin_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('entidadId_required_for_entity_plan_owner');
  });

  it('rechaza planOwnerType=veterinaria con planOwnerId distinto de veterinariaId', () => {
    const result = validateConsumoScopeV2({
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      veterinariaId: 'vetclin_1',
      planOwnerType: 'veterinaria',
      planOwnerId: 'vetclin_2',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('veterinaria_plan_owner_id_mismatch');
  });

  it('rechaza vet independiente con planOwnerType=entidad', () => {
    const result = validateConsumoScopeV2({
      accountType: 'vet_individual',
      accountId: 'vet_u9',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('vet_individual_plan_owner_type_mismatch');
  });

  it('rechaza consumo sin planOwnerId', () => {
    const result = validateConsumoScopeV2({
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      veterinariaId: 'vetclin_1',
      planOwnerType: 'veterinaria',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('planOwnerId_required');
  });

  it('rechaza veterinaria bajo entidad sin veterinariaId', () => {
    const result = validateConsumoScopeV2({
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      entidadId: 'ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('veterinariaId_required');
  });

  it('resolveConsumoPlanOwnerV2 falla cerrado cuando el scope es invalido', () => {
    expect(() =>
      resolveConsumoPlanOwnerV2(
        {
          accountType: 'veterinaria',
          accountId: 'vetclin_1',
          veterinariaId: 'vetclin_1',
          planOwnerType: 'veterinaria',
        },
        PERIODO,
      ),
    ).toThrow('planOwnerId_required');
  });
});
