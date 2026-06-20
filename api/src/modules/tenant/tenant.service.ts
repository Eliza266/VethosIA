import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import {
  AccountTypeV2,
  AuthUser,
  PlanOwnerTypeV2,
  Rol,
  RolV2,
  VinculoTipoV2,
} from '../../common/auth/auth-user.interface';
import { NotificacionesService } from '../plataforma/notificaciones.service';

export interface OrganizacionInput {
  nombre: string;
  plan?: 'free' | 'pro' | 'enterprise';
  ciudad?: string;
}

export interface MiembroDoc {
  orgId: string;
  rol: Rol;
  uid?: string;
  role?: RolV2;
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  membershipId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  vinculoTipo?: VinculoTipoV2;
  estado?: 'activo' | 'inactivo' | 'bloqueado';
}

export interface EntidadDoc {
  id: string;
  nombre: string;
  tipo?: 'gobierno' | 'cadena' | 'ong' | 'entidad' | null;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  logoUrl?: string | null;
  estado: 'activa' | 'inactiva';
  legacyOrgId?: string | null;
  planOwnerType: 'entidad';
  planOwnerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VeterinariaDoc {
  id: string;
  nombre: string;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  logoUrl?: string | null;
  orgId?: string | null;
  legacyOrgId?: string | null;
  entidadId?: string | null;
  planOwnerType: Extract<PlanOwnerTypeV2, 'veterinaria' | 'entidad'>;
  planOwnerId: string;
  accountType: 'veterinaria';
  accountId: string;
  estado: 'activa' | 'inactiva';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UpsertVeterinariaInput {
  veterinariaId?: string;
  nombre: string;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  logoUrl?: string | null;
  orgId?: string | null;
  legacyOrgId?: string | null;
  entidadId?: string | null;
  planOwnerType: Extract<PlanOwnerTypeV2, 'veterinaria' | 'entidad'>;
  planOwnerId?: string;
  estado?: 'activa' | 'inactiva';
}

export interface AsignarMiembroV2Input {
  uid: string;
  email?: string | null;
  orgId?: string | null;
  rol: Extract<Rol, 'admin' | 'vet'>;
  role: Exclude<RolV2, 'superadmin'>;
  accountType: AccountTypeV2;
  accountId: string;
  entidadId?: string | null;
  veterinariaId?: string | null;
  membershipId?: string;
  planOwnerType: PlanOwnerTypeV2;
  planOwnerId: string;
  vinculoTipo?: VinculoTipoV2;
}

export interface PerfilVeterinarioDoc {
  uid: string;
  nombre: string;
  email: string | null;
  foto?: string | null;
  telefono?: string | null;
  whatsapp?: string | null;
  ciudad?: string | null;
  sede?: string | null;
  veterinaria?: string | null;
  matriculaProfesional?: string | null;
}

// Maneja el modelo multi-tenant: crear org, dar de alta miembros y -lo importante- setear
// los custom claims {orgId, rol}. Esos claims son los que despues leen el AuthGuard y las
// reglas de Firestore (request.auth.token.orgId) para aislar por clinica.
@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  // Crea la org y deja al usuario que la crea como admin (onboarding self-service).
  // GUARDA: si el usuario YA pertenece a una org, NO creamos otra ni le pisamos los claims
  // (eso lo dejaria fuera de su org actual). Debe salir de la org previa primero.
  async crearOrganizacion(input: OrganizacionInput, ownerUid: string): Promise<{ orgId: string }> {
    const existente = await this.obtenerMiembro(ownerUid);
    if (existente) {
      throw new ConflictException(
        'Ya perteneces a una organizacion; no puedes crear otra sin salir de la actual.',
      );
    }
    const db = this.firebase.firestore;
    const orgRef = db.collection(COLLECTIONS.organizaciones).doc();
    await orgRef.set({
      nombre: input.nombre,
      plan: input.plan ?? 'free',
      ciudad: input.ciudad ?? null,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    await this.asignarMiembro(orgRef.id, ownerUid, 'admin');
    this.logger.log(`Org ${orgRef.id} creada por ${ownerUid}`);
    return { orgId: orgRef.id };
  }

  // Alta de miembro = doc en /miembros/{uid} + custom claims. Idempotente: si ya existe,
  // actualiza el rol/org. OJO: los claims solo aplican cuando el cliente refresca el ID token
  // (getIdToken(true)); avisarle al front que fuerce el refresh tras un cambio de rol.
  async asignarMiembro(orgId: string, uid: string, rol: Rol): Promise<MiembroDoc> {
    if (rol !== 'admin' && rol !== 'vet') {
      throw new BadRequestException('Rol de miembro no permitido.');
    }
    const db = this.firebase.firestore;
    await db.collection(COLLECTIONS.miembros).doc(uid).set(
      {
        orgId,
        rol,
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // merge con los claims existentes por si hubiera otros que no queremos pisar.
    const userRecord = await this.firebase.auth.getUser(uid);
    const prev = userRecord.customClaims ?? {};
    await this.firebase.auth.setCustomUserClaims(uid, { ...prev, orgId, rol });

    // notificacion de bienvenida al nuevo miembro (canal in-app, Fase 1).
    await this.notificaciones.crear({
      destinatarioUid: uid,
      orgId,
      tipo: 'bienvenida',
      titulo: 'Bienvenido a Vethos AI',
      cuerpo: 'Tu cuenta quedo activa en la entidad. Ya puedes registrar pacientes y consultas.',
    });

    this.logger.log(`Miembro ${uid} -> org ${orgId} como ${rol}`);
    return { orgId, rol };
  }

  async asignarMiembroV2(input: AsignarMiembroV2Input): Promise<MiembroDoc> {
    this.assertMembershipV2Valida(input);
    const membershipId = input.membershipId ?? `m_${input.uid}_${input.role}`;
    const orgId = input.orgId ?? undefined;
    const payload = stripUndefinedFields({
      uid: input.uid,
      email: input.email ?? undefined,
      orgId,
      rol: input.rol,
      role: input.role,
      accountType: input.accountType,
      accountId: input.accountId,
      entidadId: input.entidadId ?? undefined,
      veterinariaId: input.veterinariaId ?? undefined,
      membershipId,
      planOwnerType: input.planOwnerType,
      planOwnerId: input.planOwnerId,
      vinculoTipo: input.vinculoTipo,
      estado: 'activo',
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    await this.firebase.firestore.collection(COLLECTIONS.miembros).doc(membershipId).set(payload, {
      merge: true,
    });

    const userRecord = await this.firebase.auth.getUser(input.uid);
    const prev = userRecord.customClaims ?? {};
    await this.firebase.auth.setCustomUserClaims(input.uid, {
      ...prev,
      orgId: orgId ?? null,
      rol: input.rol,
      v: 2,
      role: input.role,
      accountType: input.accountType,
      accountId: input.accountId,
      entidadId: input.entidadId ?? null,
      veterinariaId: input.veterinariaId ?? null,
      membershipId,
      planOwnerType: input.planOwnerType,
      planOwnerId: input.planOwnerId,
      vinculoTipo: input.vinculoTipo ?? null,
    });

    if (orgId) {
      await this.notificaciones.crear({
        destinatarioUid: input.uid,
        orgId,
        tipo: 'bienvenida',
        titulo: 'Bienvenido a Vethos AI',
        cuerpo: 'Tu cuenta quedo activa en la veterinaria. Ya puedes operar dentro del scope asignado.',
      });
    }

    this.logger.log(`Membership V2 ${membershipId} -> ${input.role} ${input.accountId}`);
    const mapped = this.mapMiembroDoc(payload, membershipId);
    if (!mapped) {
      throw new BadRequestException('Membership V2 invalido.');
    }
    return mapped;
  }

  // Lista los miembros de una organizacion (para el panel del Admin Entidad).
  async listarMiembros(orgId: string): Promise<Array<{ uid: string; rol: Rol; bloqueado: boolean }>> {
    const snap = await this.firebase.firestore
      .collection(COLLECTIONS.miembros)
      .where('orgId', '==', orgId)
      .get();
    return snap.docs.map((d) => {
      const data = (d.data() ?? {}) as Record<string, unknown>;
      return { uid: d.id, rol: data.rol as Rol, bloqueado: data.bloqueado === true };
    });
  }

  // Bloquea/desbloquea un miembro (cuenta). Deshabilita tambien el usuario en Firebase Auth.
  async setBloqueoMiembro(uid: string, bloqueado: boolean): Promise<{ uid: string; bloqueado: boolean }> {
    await this.firebase.firestore.collection(COLLECTIONS.miembros).doc(uid).set({ bloqueado }, { merge: true });
    try {
      await this.firebase.auth.updateUser(uid, { disabled: bloqueado });
    } catch {
      /* el usuario puede no existir en Auth (datos de prueba); seguimos */
    }
    return { uid, bloqueado };
  }

  async obtenerMiembro(uid: string): Promise<MiembroDoc | null> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.miembros).doc(uid).get();
    if (!snap.exists) return null;
    return this.mapMiembroDoc(snap.data() ?? {}, snap.id);
  }

  async obtenerMembershipV2(uid: string, membershipId?: string): Promise<MiembroDoc | null> {
    if (membershipId) {
      const snap = await this.firebase.firestore.collection(COLLECTIONS.miembros).doc(membershipId).get();
      if (snap.exists) {
        const mapped = this.mapMiembroDoc(snap.data() ?? {}, snap.id);
        if (mapped?.uid === uid && mapped.role) return mapped;
      }
    }

    const snap = await this.firebase.firestore
      .collection(COLLECTIONS.miembros)
      .where('uid', '==', uid)
      .where('estado', '==', 'activo')
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const mapped = this.mapMiembroDoc(doc.data() ?? {}, doc.id);
    return mapped?.role ? mapped : null;
  }

  async upsertVeterinaria(input: UpsertVeterinariaInput): Promise<VeterinariaDoc> {
    const veterinariaId = input.veterinariaId ?? this.firebase.firestore.collection(COLLECTIONS.veterinarias).doc().id;
    const planOwnerId =
      input.planOwnerId ??
      (input.planOwnerType === 'veterinaria' ? veterinariaId : input.entidadId ?? undefined);
    if (!planOwnerId) {
      throw new BadRequestException('planOwnerId requerido para veterinaria.');
    }
    if (input.planOwnerType === 'entidad' && !input.entidadId) {
      throw new BadRequestException('entidadId requerido cuando la entidad paga el plan.');
    }

    const doc: Omit<VeterinariaDoc, 'id'> = stripUndefinedFields({
      nombre: input.nombre,
      direccion: input.direccion ?? undefined,
      ciudad: input.ciudad ?? undefined,
      pais: input.pais ?? undefined,
      telefono: input.telefono ?? undefined,
      emailContacto: input.emailContacto ?? undefined,
      logoUrl: input.logoUrl ?? undefined,
      orgId: input.orgId ?? input.legacyOrgId ?? undefined,
      legacyOrgId: input.legacyOrgId ?? input.orgId ?? undefined,
      entidadId: input.entidadId ?? undefined,
      planOwnerType: input.planOwnerType,
      planOwnerId,
      accountType: 'veterinaria',
      accountId: veterinariaId,
      estado: input.estado ?? 'activa',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }) as Omit<VeterinariaDoc, 'id'>;

    await this.firebase.firestore.collection(COLLECTIONS.veterinarias).doc(veterinariaId).set(doc, {
      merge: true,
    });
    return { id: veterinariaId, ...doc };
  }

  async obtenerVeterinaria(veterinariaId: string): Promise<VeterinariaDoc | null> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.veterinarias).doc(veterinariaId).get();
    if (!snap.exists) return null;
    return this.mapVeterinariaDoc(snap.id, snap.data() ?? {});
  }

  async obtenerPerfilVeterinario(uid: string): Promise<PerfilVeterinarioDoc | null> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.veterinarios).doc(uid).get();
    if (!snap.exists) return null;
    return this.mapPerfilVeterinario(uid, snap.data() ?? {});
  }

  // Crea el doc veterinarios/{uid} server-side si falta (bootstrap tenant sin setDoc cliente).
  async asegurarPerfilVeterinario(
    uid: string,
    fallback: { nombre?: string; email?: string | null; foto?: string | null },
  ): Promise<PerfilVeterinarioDoc> {
    const existente = await this.obtenerPerfilVeterinario(uid);
    if (existente) return existente;

    let nombre = fallback.nombre ?? 'Veterinario';
    let email = fallback.email ?? null;
    let foto = fallback.foto ?? null;
    try {
      const authUser = await this.firebase.auth.getUser(uid);
      nombre = authUser.displayName ?? nombre;
      email = authUser.email ?? email;
      foto = authUser.photoURL ?? foto;
    } catch {
      /* datos de prueba sin registro Auth */
    }

    const payload: Record<string, unknown> = {
      uid,
      nombre,
      email,
      foto,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    };
    await this.firebase.firestore.collection(COLLECTIONS.veterinarios).doc(uid).set(payload);
    return this.mapPerfilVeterinario(uid, payload);
  }

  async actualizarPerfilVeterinario(
    uid: string,
    dto: Record<string, unknown>,
  ): Promise<PerfilVeterinarioDoc> {
    const payload = stripUndefinedFields(dto);
    await this.firebase.firestore.collection(COLLECTIONS.veterinarios).doc(uid).set(
      {
        ...payload,
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    const actualizado = await this.obtenerPerfilVeterinario(uid);
    if (!actualizado) {
      throw new ConflictException('No se pudo actualizar el perfil veterinario.');
    }
    return actualizado;
  }

  async obtenerNombreOrganizacion(orgId: string): Promise<string | null> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.organizaciones).doc(orgId).get();
    if (!snap.exists) return null;
    const nombre = snap.data()?.nombre;
    return typeof nombre === 'string' ? nombre : null;
  }

  async obtenerNombreVeterinaria(veterinariaId: string): Promise<string | null> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.veterinarias).doc(veterinariaId).get();
    if (!snap.exists) return null;
    const nombre = snap.data()?.nombre;
    return typeof nombre === 'string' ? nombre : null;
  }

  private mapPerfilVeterinario(uid: string, data: Record<string, unknown>): PerfilVeterinarioDoc {
    return {
      uid,
      nombre: typeof data.nombre === 'string' ? data.nombre : 'Veterinario',
      email: typeof data.email === 'string' ? data.email : null,
      foto: typeof data.foto === 'string' ? data.foto : null,
      telefono: typeof data.telefono === 'string' ? data.telefono : null,
      whatsapp: typeof data.whatsapp === 'string' ? data.whatsapp : null,
      ciudad: typeof data.ciudad === 'string' ? data.ciudad : null,
      sede: typeof data.sede === 'string' ? data.sede : null,
      veterinaria: typeof data.veterinaria === 'string' ? data.veterinaria : null,
      matriculaProfesional:
        typeof data.matriculaProfesional === 'string' ? data.matriculaProfesional : null,
    };
  }

  private mapMiembroDoc(data: Record<string, unknown>, id: string): MiembroDoc | null {
    const orgId = typeof data.orgId === 'string' ? data.orgId : undefined;
    const rol = parseRol(data.rol);
    if (!rol) return null;
    return stripUndefinedFields({
      uid: typeof data.uid === 'string' ? data.uid : id,
      orgId,
      rol,
      role: parseRolV2(data.role),
      accountType: parseAccountType(data.accountType),
      accountId: str(data.accountId),
      entidadId: str(data.entidadId),
      veterinariaId: str(data.veterinariaId),
      membershipId: str(data.membershipId) ?? id,
      planOwnerType: parsePlanOwnerType(data.planOwnerType),
      planOwnerId: str(data.planOwnerId),
      vinculoTipo: parseVinculoTipo(data.vinculoTipo),
      estado: parseEstadoMembership(data.estado),
    }) as MiembroDoc;
  }

  private mapVeterinariaDoc(id: string, data: Record<string, unknown>): VeterinariaDoc | null {
    const nombre = str(data.nombre);
    const planOwnerType =
      data.planOwnerType === 'veterinaria' || data.planOwnerType === 'entidad'
        ? data.planOwnerType
        : undefined;
    const planOwnerId = str(data.planOwnerId);
    if (!nombre || !planOwnerType || !planOwnerId) return null;
    return stripUndefinedFields({
      id,
      nombre,
      direccion: str(data.direccion) ?? null,
      ciudad: str(data.ciudad) ?? null,
      pais: str(data.pais) ?? null,
      telefono: str(data.telefono) ?? null,
      emailContacto: str(data.emailContacto) ?? str(data.email) ?? str(data.correo) ?? null,
      logoUrl: str(data.logoUrl) ?? str(data.logo) ?? null,
      orgId: str(data.orgId) ?? str(data.legacyOrgId) ?? null,
      legacyOrgId: str(data.legacyOrgId) ?? str(data.orgId) ?? null,
      entidadId: str(data.entidadId) ?? null,
      planOwnerType,
      planOwnerId,
      accountType: 'veterinaria',
      accountId: str(data.accountId) ?? id,
      estado: data.estado === 'inactiva' ? 'inactiva' : 'activa',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }) as VeterinariaDoc;
  }

  private assertMembershipV2Valida(input: AsignarMiembroV2Input): void {
    if (input.role === 'admin_veterinaria') {
      if (input.accountType !== 'veterinaria' || !input.veterinariaId) {
        throw new BadRequestException('admin_veterinaria requiere veterinariaId.');
      }
      if (input.accountId !== input.veterinariaId) {
        throw new BadRequestException('accountId debe coincidir con veterinariaId.');
      }
      if (input.planOwnerType === 'veterinaria' && input.planOwnerId !== input.veterinariaId) {
        throw new BadRequestException('planOwnerId debe coincidir con veterinariaId.');
      }
      if (input.planOwnerType === 'entidad' && !input.entidadId) {
        throw new BadRequestException('entidadId requerido para plan heredado.');
      }
    }
    if (input.role === 'veterinario' && input.accountType === 'veterinaria' && !input.veterinariaId) {
      throw new BadRequestException('veterinario de veterinaria requiere veterinariaId.');
    }
  }
}

function stripUndefinedFields<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function parseRol(value: unknown): Rol | undefined {
  return value === 'superadmin' || value === 'admin' || value === 'vet' || value === 'asistente'
    ? value
    : undefined;
}

function parseRolV2(value: unknown): RolV2 | undefined {
  return value === 'superadmin' ||
    value === 'admin_entidad' ||
    value === 'admin_veterinaria' ||
    value === 'veterinario'
    ? value
    : undefined;
}

function parseAccountType(value: unknown): AccountTypeV2 | undefined {
  return value === 'vet_individual' || value === 'veterinaria' || value === 'entidad'
    ? value
    : undefined;
}

function parsePlanOwnerType(value: unknown): PlanOwnerTypeV2 | undefined {
  return value === 'vet' || value === 'veterinaria' || value === 'entidad' ? value : undefined;
}

function parseVinculoTipo(value: unknown): VinculoTipoV2 | undefined {
  return value === 'staff' || value === 'freelance' || value === 'owner' ? value : undefined;
}

function parseEstadoMembership(value: unknown): MiembroDoc['estado'] | undefined {
  return value === 'activo' || value === 'inactivo' || value === 'bloqueado' ? value : undefined;
}
