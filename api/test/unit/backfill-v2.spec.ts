import {
  BackfillConsumptionV2,
  BackfillDocumentV2,
  LegacyOrgMappingV2,
  planBackfillDryRunV2,
} from '../../src/modules/tenant/backfill-v2';

describe('backfill V2 dry-run', () => {
  const mappings: LegacyOrgMappingV2[] = [
    {
      orgId: 'orgA',
      status: 'reviewed',
      accountType: 'veterinaria',
      accountId: 'vetclin_A',
      veterinariaId: 'vetclin_A',
      planOwnerType: 'veterinaria',
      planOwnerId: 'vetclin_A',
    },
    {
      orgId: 'orgEnt',
      status: 'reviewed',
      accountType: 'veterinaria',
      accountId: 'vetclin_Ent_1',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_Ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    },
    { orgId: 'orgAmbigua', status: 'needs_review' },
  ];

  it('mapea documentos legacy revisados sin escribir datos reales', () => {
    const documents: BackfillDocumentV2[] = [
      { collection: 'pacientes', id: 'p1', orgId: 'orgEnt', veterinarioId: 'vet1' },
      { collection: 'pacientes', id: 'p2', veterinarioId: 'legacyVet' },
    ];
    const snapshot = JSON.stringify(documents);
    const result = planBackfillDryRunV2({
      mappings,
      documents,
    });

    expect(result.documentUpdates).toHaveLength(2);
    expect(result.documentUpdates[0].patch).toMatchObject({
      accountType: 'veterinaria',
      accountId: 'vetclin_Ent_1',
      entidadId: 'ent_1',
      veterinariaId: 'vetclin_Ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      legacyOrgId: 'orgEnt',
      migrationStatus: 'migrated',
    });
    expect(result.documentUpdates[1].patch).toMatchObject({
      accountType: 'vet_individual',
      accountId: 'vet_legacyVet',
      planOwnerType: 'vet',
      planOwnerId: 'vet_legacyVet',
    });
    expect(JSON.stringify(documents)).toBe(snapshot);
  });

  it('casos ambiguos quedan como needs_review', () => {
    const result = planBackfillDryRunV2({
      mappings,
      documents: [{ collection: 'pacientes', id: 'p-amb', orgId: 'orgAmbigua' }],
      consumptions: [{ id: 'orgAmbigua_2026-06', scopeId: 'orgAmbigua', periodo: '2026-06', usados: 3 }],
    });

    expect(result.documentNeedsReview).toEqual([
      { collection: 'pacientes', id: 'p-amb', reason: 'legacy_org_mapping_missing_or_ambiguous' },
    ]);
    expect(result.consumptionNeedsReview).toEqual([
      { id: 'orgAmbigua_2026-06', reason: 'consumption_owner_needs_review' },
    ]);
  });

  it('segunda corrida no duplica consumo ni cambia documentos ya migrados', () => {
    const documents: BackfillDocumentV2[] = [
      { collection: 'consultas', id: 'c1', orgId: 'orgEnt', veterinarioId: 'vet1' },
    ];
    const consumptions: BackfillConsumptionV2[] = [
      { id: 'orgEnt_2026-06', scopeId: 'orgEnt', orgId: 'orgEnt', periodo: '2026-06', usados: 7 },
    ];
    const mappingsSnapshot = JSON.stringify(mappings);

    const first = planBackfillDryRunV2({ mappings, documents, consumptions });
    expect(first.documentUpdates).toHaveLength(1);
    expect(first.consumptionCreates).toHaveLength(1);
    expect(first.consumptionCreates[0].targetDocId).toBe('ent_1_2026-06');

    const migratedDocuments: BackfillDocumentV2[] = [
      {
        ...documents[0],
        ...first.documentUpdates[0].patch,
      },
    ];
    const migratedConsumptions: BackfillConsumptionV2[] = [
      {
        ...consumptions[0],
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
        migrationStatus: 'migrated',
      },
    ];

    const second = planBackfillDryRunV2({
      mappings,
      documents: migratedDocuments,
      consumptions: migratedConsumptions,
      existingConsumptionTargetIds: first.consumptionCreates.map((op) => op.targetDocId),
    });

    expect(second.documentUpdates).toHaveLength(0);
    expect(second.consumptionCreates).toHaveLength(0);
    expect(second.documentNoops).toEqual([
      { collection: 'consultas', id: 'c1', reason: 'already_migrated' },
    ]);
    expect(second.consumptionNoops).toEqual([
      { id: 'orgEnt_2026-06', reason: 'already_migrated' },
    ]);
    expect(JSON.stringify(mappings)).toBe(mappingsSnapshot);
  });

  it('no crea dos consumos si dos fuentes apuntan al mismo target', () => {
    const result = planBackfillDryRunV2({
      mappings,
      consumptions: [
        { id: 'orgEnt_2026-06', scopeId: 'orgEnt', orgId: 'orgEnt', periodo: '2026-06', usados: 7 },
        { id: 'orgEnt_dup_2026-06', scopeId: 'orgEnt', orgId: 'orgEnt', periodo: '2026-06', usados: 2 },
      ],
    });

    expect(result.consumptionCreates).toHaveLength(1);
    expect(result.consumptionNoops).toEqual([
      { id: 'orgEnt_dup_2026-06', reason: 'target_already_exists' },
    ]);
  });
});
