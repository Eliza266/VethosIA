import { Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { BrigadaAtencionDoc, BrigadaDoc, EstadoBrigada, UbicacionBrigada } from './brigada.types';
import { runtimeScopeFromRecord, type RuntimeTenantFilter } from '../../common/auth/runtime-v2';

@Injectable()
export class BrigadasRepository {
  constructor(private readonly firebase: FirebaseService) {}

  private get col(): admin.firestore.CollectionReference {
    return this.firebase.firestore.collection(COLLECTIONS.brigadas);
  }

  private get atencionesCol(): admin.firestore.CollectionReference {
    return this.firebase.firestore.collection(COLLECTIONS.brigadaAtenciones);
  }

  ref(id: string): admin.firestore.DocumentReference {
    return this.col.doc(id);
  }

  async getById(id: string): Promise<BrigadaDoc> {
    const snap = await this.ref(id).get();
    if (!snap.exists) throw new NotFoundException(`Brigada ${id} no existe.`);
    return this.fromSnap(snap);
  }

  async crear(data: Omit<BrigadaDoc, 'id' | 'creadoEn' | 'actualizadoEn'>): Promise<BrigadaDoc> {
    const ref = this.col.doc();
    const payload = {
      ...cleanFirestoreData(data),
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(payload);
    const snap = await ref.get();
    return this.fromSnap(snap);
  }

  async mergeRaw(id: string, data: Record<string, unknown>): Promise<void> {
    await this.ref(id).set(
      {
        ...cleanFirestoreData(data),
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  async listar(tenant: RuntimeTenantFilter): Promise<BrigadaDoc[]> {
    const byId = new Map<string, BrigadaDoc>();
    for (const q of this.queriesTenant(tenant)) {
      const snap = await q.get();
      for (const d of snap.docs) {
        if (!byId.has(d.id)) byId.set(d.id, this.fromSnap(d));
      }
    }
    const list = [...byId.values()];
    list.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return list;
  }

  async listarAtenciones(brigadaId: string): Promise<BrigadaAtencionDoc[]> {
    const snap = await this.atencionesCol.where('brigadaId', '==', brigadaId).get();
    const list = snap.docs.map((doc) => this.fromAtencionSnap(doc));
    list.sort((a, b) => new Date(b.fechaHora).getTime() - new Date(a.fechaHora).getTime());
    return list;
  }

  async crearAtencion(
    data: Omit<BrigadaAtencionDoc, 'id' | 'creadoEn' | 'actualizadoEn'>,
  ): Promise<BrigadaAtencionDoc> {
    const ref = this.atencionesCol.doc();
    await ref.set({
      ...cleanFirestoreData(data),
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    const snap = await ref.get();
    return this.fromAtencionSnap(snap);
  }

  private queriesTenant(tenant: RuntimeTenantFilter): admin.firestore.Query[] {
    const queries: admin.firestore.Query[] = [];
    const v2 = this.queryV2(tenant);
    if (v2) queries.push(v2);
    if (tenant.orgId) queries.push(this.col.where('orgId', '==', tenant.orgId));
    else if (tenant.uid) queries.push(this.col.where('veterinarioIds', 'array-contains', tenant.uid));
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
  ): BrigadaDoc {
    const d = (snap.data() ?? {}) as Record<string, unknown>;
    const scope = runtimeScopeFromRecord(d);
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
    const ubicRaw = (d.ubicacion ?? {}) as Record<string, unknown>;
    const ubicacion: UbicacionBrigada = {
      direccion: str(ubicRaw.direccion) ?? '',
      ciudad: str(ubicRaw.ciudad) ?? '',
      lat: num(ubicRaw.lat),
      lng: num(ubicRaw.lng),
    };
    const vIds = Array.isArray(d.veterinarioIds)
      ? d.veterinarioIds.filter((x): x is string => typeof x === 'string')
      : [];
    const estado = str(d.estado) as EstadoBrigada | undefined;
    return {
      id: snap.id,
      nombre: str(d.nombre) ?? '',
      descripcion: str(d.descripcion),
      fecha: str(d.fecha) ?? '',
      ubicacion,
      veterinarioIds: vIds,
      orgId: str(d.orgId),
      accountType: scope.accountType,
      accountId: scope.accountId,
      entidadId: scope.entidadId,
      veterinariaId: scope.veterinariaId,
      planOwnerType: scope.planOwnerType,
      planOwnerId: scope.planOwnerId,
      membershipId: scope.membershipId,
      legacyOrgId: scope.legacyOrgId,
      estado: estado ?? 'planificada',
      totalConsultas: num(d.totalConsultas),
      creadoEn: this.tsToIso(d.creadoEn),
      actualizadoEn: this.tsToIso(d.actualizadoEn),
    };
  }

  private fromAtencionSnap(
    snap: admin.firestore.DocumentSnapshot | admin.firestore.QueryDocumentSnapshot,
  ): BrigadaAtencionDoc {
    const d = (snap.data() ?? {}) as Record<string, unknown>;
    const scope = runtimeScopeFromRecord(d);
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    return {
      id: snap.id,
      brigadaId: str(d.brigadaId) ?? '',
      pacienteId: str(d.pacienteId),
      consultaId: str(d.consultaId),
      veterinarioId: str(d.veterinarioId) ?? '',
      motivo: str(d.motivo) ?? '',
      notas: str(d.notas),
      especie: str(d.especie),
      fechaHora: str(d.fechaHora) ?? this.tsToIso(d.fechaHora) ?? '',
      orgId: str(d.orgId),
      accountType: scope.accountType,
      accountId: scope.accountId,
      entidadId: scope.entidadId,
      veterinariaId: scope.veterinariaId,
      planOwnerType: scope.planOwnerType,
      planOwnerId: scope.planOwnerId,
      membershipId: scope.membershipId,
      legacyOrgId: scope.legacyOrgId,
      createdBy: str(d.createdBy) ?? '',
      creadoEn: this.tsToIso(d.creadoEn),
      actualizadoEn: this.tsToIso(d.actualizadoEn),
    };
  }

  private tsToIso(v: unknown): string | undefined {
    if (v && typeof v === 'object' && 'toDate' in v && typeof v.toDate === 'function') {
      return (v as admin.firestore.Timestamp).toDate().toISOString();
    }
    return typeof v === 'string' ? v : undefined;
  }
}

function cleanFirestoreData<T extends Record<string, unknown>>(value: T): Partial<T> {
  const entries = Object.entries(value)
    .map(([key, raw]) => [key, cleanFirestoreValue(raw)] as const)
    .filter(([, raw]) => raw !== undefined);
  return Object.fromEntries(entries) as Partial<T>;
}

function cleanFirestoreValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.map(cleanFirestoreValue).filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    return cleanFirestoreData(value as Record<string, unknown>);
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
