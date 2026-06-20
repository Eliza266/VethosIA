import type { AccountTypeV2, PlanOwnerTypeV2 } from '../../common/auth/auth-user.interface';

export interface LegacyOrgMappingV2 {
  orgId: string;
  status: 'reviewed' | 'needs_review';
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
}

export interface BackfillDocumentV2 {
  collection: string;
  id: string;
  orgId?: string;
  veterinarioId?: string;
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  migrationStatus?: 'migrated' | 'needs_review' | 'reviewed';
}

export interface BackfillConsumptionV2 {
  id: string;
  scopeId: string;
  periodo: string;
  usados: number;
  orgId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  migrationStatus?: 'migrated' | 'needs_review';
}

export interface BackfillDryRunInputV2 {
  mappings: LegacyOrgMappingV2[];
  documents?: BackfillDocumentV2[];
  consumptions?: BackfillConsumptionV2[];
  existingConsumptionTargetIds?: string[];
  migrationVersion?: number;
}

export interface BackfillDryRunResultV2 {
  documentUpdates: Array<{ collection: string; id: string; patch: Record<string, unknown> }>;
  documentNeedsReview: Array<{ collection: string; id: string; reason: string }>;
  documentNoops: Array<{ collection: string; id: string; reason: string }>;
  consumptionCreates: Array<{ sourceId: string; targetDocId: string; patch: Record<string, unknown> }>;
  consumptionNeedsReview: Array<{ id: string; reason: string }>;
  consumptionNoops: Array<{ id: string; reason: string }>;
}

export function planBackfillDryRunV2(input: BackfillDryRunInputV2): BackfillDryRunResultV2 {
  const migrationVersion = input.migrationVersion ?? 1;
  const mappings = new Map(input.mappings.map((m) => [m.orgId, m]));
  const result: BackfillDryRunResultV2 = {
    documentUpdates: [],
    documentNeedsReview: [],
    documentNoops: [],
    consumptionCreates: [],
    consumptionNeedsReview: [],
    consumptionNoops: [],
  };

  for (const doc of input.documents ?? []) {
    const patch = resolveDocumentPatch(doc, mappings, migrationVersion);
    if (patch.kind === 'update') {
      result.documentUpdates.push({ collection: doc.collection, id: doc.id, patch: patch.patch });
    } else if (patch.kind === 'needs_review') {
      result.documentNeedsReview.push({ collection: doc.collection, id: doc.id, reason: patch.reason });
    } else {
      result.documentNoops.push({ collection: doc.collection, id: doc.id, reason: patch.reason });
    }
  }

  const targetIds = new Set(input.existingConsumptionTargetIds ?? []);
  for (const consumo of input.consumptions ?? []) {
    const op = resolveConsumptionCreate(consumo, mappings, targetIds, migrationVersion);
    if (op.kind === 'create') {
      targetIds.add(op.targetDocId);
      result.consumptionCreates.push({ sourceId: consumo.id, targetDocId: op.targetDocId, patch: op.patch });
    } else if (op.kind === 'needs_review') {
      result.consumptionNeedsReview.push({ id: consumo.id, reason: op.reason });
    } else {
      result.consumptionNoops.push({ id: consumo.id, reason: op.reason });
    }
  }

  return result;
}

function resolveDocumentPatch(
  doc: BackfillDocumentV2,
  mappings: Map<string, LegacyOrgMappingV2>,
  migrationVersion: number,
):
  | { kind: 'update'; patch: Record<string, unknown> }
  | { kind: 'needs_review'; reason: string }
  | { kind: 'noop'; reason: string } {
  if (doc.migrationStatus === 'reviewed') return { kind: 'noop', reason: 'reviewed_mapping_preserved' };
  if (doc.migrationStatus === 'migrated' && doc.accountId && doc.planOwnerId) {
    return { kind: 'noop', reason: 'already_migrated' };
  }

  if (doc.orgId) {
    const mapping = mappings.get(doc.orgId);
    if (!isReviewedComplete(mapping)) {
      return { kind: 'needs_review', reason: 'legacy_org_mapping_missing_or_ambiguous' };
    }
    return {
      kind: 'update',
      patch: stripUndefined({
        accountType: mapping.accountType,
        accountId: mapping.accountId,
        entidadId: mapping.entidadId,
        veterinariaId: mapping.veterinariaId,
        planOwnerType: mapping.planOwnerType,
        planOwnerId: mapping.planOwnerId,
        legacyOrgId: doc.orgId,
        migrationStatus: 'migrated',
        migrationVersion,
      }),
    };
  }

  if (doc.veterinarioId) {
    const vetAccountId = `vet_${doc.veterinarioId}`;
    return {
      kind: 'update',
      patch: {
        accountType: 'vet_individual',
        accountId: vetAccountId,
        planOwnerType: 'vet',
        planOwnerId: vetAccountId,
        migrationStatus: 'migrated',
        migrationVersion,
      },
    };
  }

  return { kind: 'needs_review', reason: 'insufficient_legacy_scope' };
}

function resolveConsumptionCreate(
  consumo: BackfillConsumptionV2,
  mappings: Map<string, LegacyOrgMappingV2>,
  targetIds: Set<string>,
  migrationVersion: number,
):
  | { kind: 'create'; targetDocId: string; patch: Record<string, unknown> }
  | { kind: 'needs_review'; reason: string }
  | { kind: 'noop'; reason: string } {
  if (consumo.migrationStatus === 'migrated' && consumo.planOwnerId) {
    return { kind: 'noop', reason: 'already_migrated' };
  }

  const owner = resolveConsumptionOwner(consumo, mappings);
  if (!owner) return { kind: 'needs_review', reason: 'consumption_owner_needs_review' };

  const targetDocId = `${owner.planOwnerId}_${consumo.periodo}`;
  if (targetIds.has(targetDocId)) {
    return { kind: 'noop', reason: 'target_already_exists' };
  }

  return {
    kind: 'create',
    targetDocId,
    patch: {
      usados: consumo.usados,
      periodo: consumo.periodo,
      scopeId: owner.planOwnerId,
      planOwnerType: owner.planOwnerType,
      planOwnerId: owner.planOwnerId,
      legacyScopeId: consumo.scopeId,
      migrationStatus: 'migrated',
      migrationVersion,
    },
  };
}

function resolveConsumptionOwner(
  consumo: BackfillConsumptionV2,
  mappings: Map<string, LegacyOrgMappingV2>,
): { planOwnerType: PlanOwnerTypeV2; planOwnerId: string } | null {
  if (consumo.orgId || mappings.has(consumo.scopeId)) {
    const mapping = mappings.get(consumo.orgId ?? consumo.scopeId);
    if (!isReviewedComplete(mapping)) return null;
    return { planOwnerType: mapping.planOwnerType, planOwnerId: mapping.planOwnerId };
  }
  if (consumo.scopeId.startsWith('vet_')) {
    return { planOwnerType: 'vet', planOwnerId: consumo.scopeId };
  }
  return null;
}

function isReviewedComplete(mapping?: LegacyOrgMappingV2): mapping is Required<LegacyOrgMappingV2> {
  return (
    !!mapping &&
    mapping.status === 'reviewed' &&
    isNonEmpty(mapping.accountType) &&
    isNonEmpty(mapping.accountId) &&
    isNonEmpty(mapping.planOwnerType) &&
    isNonEmpty(mapping.planOwnerId)
  );
}

function stripUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}

function isNonEmpty(value?: string): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
