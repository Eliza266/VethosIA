import { Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import {
  COLLECTIONS,
  contadorPacDocId,
  formatoPacId,
} from '../../common/firebase/collections';
import { PacienteDoc } from './paciente.types';
import { runtimeScopeFromRecord, type RuntimeTenantFilter } from '../../common/auth/runtime-v2';

// Acceso a Firestore para pacientes. Sin 'any': mapeo defensivo del snapshot.
@Injectable()
export class PacientesRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get col(): admin.firestore.CollectionReference {
    return this.firebase.firestore.collection(COLLECTIONS.pacientes);
  }

  ref(id: string): admin.firestore.DocumentReference {
    return this.col.doc(id);
  }

  async getById(id: string): Promise<PacienteDoc> {
    const snap = await this.ref(id).get();
    if (!snap.exists) throw new NotFoundException(`Paciente ${id} no existe.`);
    return this.fromSnap(snap);
  }

  // Crea el paciente y asigna un id legible (PAC-000256) atomico por clinica.
  async crear(data: Omit<PacienteDoc, 'id' | 'codigo'>, tenant: string): Promise<PacienteDoc> {
    const db = this.firebase.firestore;
    const nuevoRef = this.col.doc();
    const contadorRef = db.collection(COLLECTIONS.configuracion).doc(contadorPacDocId(tenant));

    const codigo = await db.runTransaction(async (tx) => {
      const snap = await tx.get(contadorRef);
      const actual = snap.exists ? this.leerUltimo(snap) : 0;
      const nuevo = actual + 1;
      tx.set(contadorRef, { ultimo: nuevo, orgId: tenant }, { merge: true });
      tx.set(nuevoRef, {
        ...data,
        codigo: formatoPacId(nuevo),
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
        deletedAt: null,
      });
      return formatoPacId(nuevo);
    });

    return { ...(data as PacienteDoc), id: nuevoRef.id, codigo, deletedAt: null };
  }

  async actualizar(id: string, data: Partial<PacienteDoc>): Promise<void> {
    await this.ref(id).set(data, { merge: true });
  }

  // Soft delete: marca deletedAt, NUNCA borra fisicamente.
  async softDelete(id: string): Promise<void> {
    await this.ref(id).set(
      { deletedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
  }

  // Lista por tenant excluyendo eliminados (deletedAt == null).
  async listar(tenant: RuntimeTenantFilter): Promise<PacienteDoc[]> {
    const docs = await this.listarPorTenantRuntime(tenant);
    return docs
      .filter((p) => p.deletedAt == null);
  }

  private async listarPorTenantRuntime(tenant: RuntimeTenantFilter): Promise<PacienteDoc[]> {
    const byId = new Map<string, PacienteDoc>();
    const queries = this.queriesTenant(tenant);
    for (const q of queries) {
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

  private leerUltimo(snap: admin.firestore.DocumentSnapshot): number {
    const v = (snap.data() ?? {}).ultimo;
    return typeof v === 'number' ? v : 0;
  }

  fromSnap(
    snap: admin.firestore.DocumentSnapshot | admin.firestore.QueryDocumentSnapshot,
  ): PacienteDoc {
    const d = (snap.data() ?? {}) as Record<string, unknown>;
    const scope = runtimeScopeFromRecord(d);
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    const numv = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
    const deletedRaw = d.deletedAt;
    return {
      id: snap.id,
      codigo: str(d.codigo),
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
      nombre: str(d.nombre) ?? '',
      especie: str(d.especie),
      raza: str(d.raza),
      fechaNacimiento: str(d.fechaNacimiento),
      edad: str(d.edad),
      sexo: str(d.sexo) as PacienteDoc['sexo'],
      estadoReproductivo: str(d.estadoReproductivo) as PacienteDoc['estadoReproductivo'],
      color: str(d.color),
      chip: str(d.chip),
      foto: str(d.foto),
      propietario: (d.propietario as PacienteDoc['propietario']) ?? undefined,
      notas: str(d.notas),
      ultimoPeso: numv(d.ultimoPeso),
      ultimaTalla: numv(d.ultimaTalla),
      esPlaceholder: typeof d.esPlaceholder === 'boolean' ? d.esPlaceholder : undefined,
      // deletedAt puede ser Timestamp (truthy) o null/undefined.
      deletedAt: deletedRaw == null ? null : (deletedRaw as PacienteDoc['deletedAt']),
    };
  }
}
