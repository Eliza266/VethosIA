import { Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { VacunaDoc } from './vacuna.types';
import { runtimeScopeFromRecord, type RuntimeTenantFilter } from '../../common/auth/runtime-v2';

@Injectable()
export class VacunasRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get col(): admin.firestore.CollectionReference {
    return this.firebase.firestore.collection(COLLECTIONS.vacunas);
  }

  ref(id: string): admin.firestore.DocumentReference {
    return this.col.doc(id);
  }

  async getById(id: string): Promise<VacunaDoc> {
    const snap = await this.ref(id).get();
    if (!snap.exists) throw new NotFoundException(`Vacuna ${id} no existe.`);
    return this.fromSnap(snap);
  }

  async crear(data: Omit<VacunaDoc, 'id' | 'estado'>): Promise<VacunaDoc> {
    const ref = this.col.doc();
    await ref.set({ ...data, creadoEn: admin.firestore.FieldValue.serverTimestamp() });
    return { ...data, id: ref.id };
  }

  async actualizar(id: string, data: Partial<VacunaDoc>): Promise<void> {
    await this.ref(id).set(data, { merge: true });
  }

  async softDelete(id: string): Promise<void> {
    await this.ref(id).set(
      { eliminadaEn: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
  }

  async listarPorPaciente(pacienteId: string): Promise<VacunaDoc[]> {
    const snap = await this.col.where('pacienteId', '==', pacienteId).get();
    return snap.docs.map((d) => this.fromSnap(d)).filter((v) => !v.eliminadaEn);
  }

  async listarPorTenant(tenant: RuntimeTenantFilter): Promise<VacunaDoc[]> {
    const byId = new Map<string, VacunaDoc>();
    for (const q of this.queriesTenant(tenant)) {
      const snap = await q.get();
      for (const d of snap.docs) {
        const vacuna = this.fromSnap(d);
        if (!vacuna.eliminadaEn && !byId.has(d.id)) byId.set(d.id, vacuna);
      }
    }
    return [...byId.values()];
  }

  private queriesTenant(tenant: RuntimeTenantFilter): admin.firestore.Query[] {
    const queries: admin.firestore.Query[] = [];
    const v2 = this.queryV2(tenant);
    if (v2) queries.push(v2);
    if (tenant.orgId) queries.push(this.col.where('orgId', '==', tenant.orgId));
    else if (tenant.uid) queries.push(this.col.where('veterinarioId', '==', tenant.uid));
    return queries;
  }

  private queryV2(tenant: RuntimeTenantFilter): admin.firestore.Query | null {
    if (tenant.entidadId) return this.col.where('entidadId', '==', tenant.entidadId);
    if (tenant.veterinariaId) return this.col.where('veterinariaId', '==', tenant.veterinariaId);
    if (tenant.accountId) return this.col.where('accountId', '==', tenant.accountId);
    return null;
  }

  fromSnap(
    snap: admin.firestore.DocumentSnapshot | admin.firestore.QueryDocumentSnapshot,
  ): VacunaDoc {
    const d = (snap.data() ?? {}) as Record<string, unknown>;
    const scope = runtimeScopeFromRecord(d);
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
    const aplicaciones = Array.isArray(d.aplicaciones)
      ? d.aplicaciones.filter((v): v is string => typeof v === 'string')
      : undefined;
    return {
      id: snap.id,
      orgId: str(d.orgId),
      veterinarioId: str(d.veterinarioId),
      accountType: scope.accountType,
      accountId: scope.accountId,
      entidadId: scope.entidadId,
      veterinariaId: scope.veterinariaId,
      planOwnerType: scope.planOwnerType,
      planOwnerId: scope.planOwnerId,
      membershipId: scope.membershipId,
      legacyOrgId: scope.legacyOrgId,
      pacienteId: str(d.pacienteId) ?? '',
      nombre: str(d.nombre) ?? '',
      especie: str(d.especie),
      catalogoCodigo: str(d.catalogoCodigo),
      intervaloDias: num(d.intervaloDias),
      fuente:
        d.fuente === 'catalogo_base' || d.fuente === 'personalizada'
          ? d.fuente
          : undefined,
      aplicada: str(d.aplicada),
      aplicaciones,
      proximaDosis: str(d.proximaDosis),
      notas: str(d.notas),
      eliminadaEn: str(d.eliminadaEn),
    };
  }
}
