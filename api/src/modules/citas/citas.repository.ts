import { Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { CitaDoc, EstadoCita } from './cita.types';
import { runtimeScopeFromRecord, type RuntimeTenantFilter } from '../../common/auth/runtime-v2';

@Injectable()
export class CitasRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get col(): admin.firestore.CollectionReference {
    return this.firebase.firestore.collection(COLLECTIONS.citas);
  }

  ref(id: string): admin.firestore.DocumentReference {
    return this.col.doc(id);
  }

  async getById(id: string): Promise<CitaDoc> {
    const snap = await this.ref(id).get();
    if (!snap.exists) throw new NotFoundException(`Cita ${id} no existe.`);
    return this.fromSnap(snap);
  }

  async crear(data: Omit<CitaDoc, 'id'>): Promise<CitaDoc> {
    const ref = this.col.doc();
    await ref.set({
      ...data,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ...data, id: ref.id };
  }

  async actualizar(id: string, data: Partial<CitaDoc>): Promise<void> {
    await this.ref(id).set(
      { ...data, actualizadoEn: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
  }

  // Lista por tenant. NO filtra canceladas: una cita cancelada permanece en historial.
  async listar(tenant: RuntimeTenantFilter): Promise<CitaDoc[]> {
    const byId = new Map<string, CitaDoc>();
    for (const q of this.queriesTenant(tenant)) {
      const snap = await q.get();
      for (const d of snap.docs) {
        if (!byId.has(d.id)) byId.set(d.id, this.fromSnap(d));
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
  ): CitaDoc {
    const d = (snap.data() ?? {}) as Record<string, unknown>;
    const scope = runtimeScopeFromRecord(d);
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
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
      pacienteId: str(d.pacienteId),
      pacienteNombre: str(d.pacienteNombre),
      propietarioNombre: str(d.propietarioNombre),
      propietarioTelefono: str(d.propietarioTelefono),
      motivo: str(d.motivo),
      titulo: str(d.titulo) ?? '',
      fecha: str(d.fecha) ?? '',
      estado: (str(d.estado) as EstadoCita) ?? 'programada',
      consultaId: str(d.consultaId),
      historiaClinicaId: str(d.historiaClinicaId),
      notas: str(d.notas),
      creadoEn: d.creadoEn,
      actualizadoEn: d.actualizadoEn,
    };
  }
}
