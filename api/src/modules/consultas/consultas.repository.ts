import { Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { ConsultaDoc } from './consulta.types';
import { runtimeScopeFromRecord, type RuntimeTenantFilter } from '../../common/auth/runtime-v2';
import { normalizarDiagnosticosEstructurados } from './diagnostico-estructurado';

// Acceso a Firestore para consultas. Tipado, sin 'any': mapeamos el snapshot a ConsultaDoc.
@Injectable()
export class ConsultasRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get col(): admin.firestore.CollectionReference {
    return this.firebase.firestore.collection(COLLECTIONS.consultas);
  }

  ref(id: string): admin.firestore.DocumentReference {
    return this.col.doc(id);
  }

  async getById(id: string): Promise<ConsultaDoc> {
    const snap = await this.ref(id).get();
    if (!snap.exists) {
      throw new NotFoundException(`Consulta ${id} no existe.`);
    }
    return this.fromSnap(snap);
  }

  async update(id: string, data: Partial<ConsultaDoc>): Promise<void> {
    await this.ref(id).set(data, { merge: true });
  }

  // merge de campos que no estan en ConsultaDoc (ej. soap, signosVitales). Tipado como
  // Record para no abrir 'any', pero permitiendo el shape libre que escribe el pipeline IA.
  async mergeRaw(id: string, data: Record<string, unknown>): Promise<void> {
    await this.ref(id).set(data, { merge: true });
  }

  async eliminar(id: string): Promise<void> {
    await this.ref(id).delete();
  }

  async crear(data: Omit<ConsultaDoc, 'id'>): Promise<ConsultaDoc> {
    const ref = this.col.doc();
    await ref.set({
      ...data,
      fechaHora: admin.firestore.FieldValue.serverTimestamp(),
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    const snap = await ref.get();
    return this.fromSnap(snap);
  }

  async listar(
    tenant: RuntimeTenantFilter,
    pacienteId?: string,
  ): Promise<ConsultaDoc[]> {
    const byId = new Map<string, ConsultaDoc>();
    for (const q of this.queriesTenant(tenant, pacienteId)) {
      const snap = await q.get();
      for (const d of snap.docs) {
        if (!byId.has(d.id)) byId.set(d.id, this.fromSnap(d));
      }
    }
    return [...byId.values()];
  }

  private queriesTenant(tenant: RuntimeTenantFilter, pacienteId?: string): admin.firestore.Query[] {
    const queries: admin.firestore.Query[] = [];
    const v2 = this.queryV2(tenant, pacienteId);
    if (v2) queries.push(v2);
    const legacy = this.queryLegacy(tenant, pacienteId);
    if (legacy) queries.push(legacy);
    return queries;
  }

  private queryV2(tenant: RuntimeTenantFilter, pacienteId?: string): admin.firestore.Query | null {
    let q: admin.firestore.Query | null = null;
    if (tenant.entidadId) q = this.col.where('entidadId', '==', tenant.entidadId);
    else if (tenant.veterinariaId) q = this.col.where('veterinariaId', '==', tenant.veterinariaId);
    else if (tenant.accountId) q = this.col.where('accountId', '==', tenant.accountId);
    if (!q) return null;
    if (pacienteId) q = q.where('pacienteId', '==', pacienteId);
    return q.orderBy('fechaHora', 'desc');
  }

  private queryLegacy(tenant: RuntimeTenantFilter, pacienteId?: string): admin.firestore.Query | null {
    let q: admin.firestore.Query | null = null;
    if (tenant.orgId) q = this.col.where('orgId', '==', tenant.orgId);
    else if (tenant.uid) q = this.col.where('veterinarioId', '==', tenant.uid);
    if (!q) return null;
    if (pacienteId) q = q.where('pacienteId', '==', pacienteId);
    return q.orderBy('fechaHora', 'desc');
  }

  // mapeo defensivo: solo extraemos campos conocidos y con el tipo esperado.
  fromSnap(
    snap:
      | admin.firestore.DocumentSnapshot
      | admin.firestore.QueryDocumentSnapshot,
  ): ConsultaDoc {
    const d = (snap.data() ?? {}) as Record<string, unknown>;
    const scope = runtimeScopeFromRecord(d);
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    const strArr = (v: unknown): string[] | undefined =>
      Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined;
    const soapRaw = d.soap;
    const soap =
      soapRaw && typeof soapRaw === 'object'
        ? (soapRaw as ConsultaDoc['soap'])
        : undefined;
    const signosRaw = d.signosVitales;
    const signosVitales =
      signosRaw && typeof signosRaw === 'object'
        ? (signosRaw as ConsultaDoc['signosVitales'])
        : undefined;
    const diagnosticoEstructurado = normalizarDiagnosticosEstructurados(
      d.diagnosticoEstructurado,
      { strict: false },
    );
    return {
      id: snap.id,
      numeroHC: str(d.numeroHC),
      pacienteId: str(d.pacienteId),
      veterinarioId: str(d.veterinarioId),
      orgId: str(d.orgId),
      accountType: scope.accountType,
      accountId: scope.accountId,
      entidadId: scope.entidadId,
      veterinariaId: scope.veterinariaId,
      planOwnerType: scope.planOwnerType,
      planOwnerId: scope.planOwnerId,
      membershipId: scope.membershipId,
      legacyOrgId: scope.legacyOrgId,
      citaId: str(d.citaId),
      estado: str(d.estado) as ConsultaDoc['estado'],
      audioUrl: str(d.audioUrl),
      audioUrls: strArr(d.audioUrls),
      audioPath: str(d.audioPath),
      transcripcion: str(d.transcripcion),
      motivo: str(d.motivo),
      prioridad: str(d.prioridad) as ConsultaDoc['prioridad'],
      signosVitales,
      soap,
      diagnosticoEstructurado,
      fechaHora: d.fechaHora,
      creadoEn: d.creadoEn,
      actualizadoEn: d.actualizadoEn,
    };
  }
}
