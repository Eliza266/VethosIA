import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { AuthUser, Rol, RolV2 } from '../../common/auth/auth-user.interface';
import { AuditoriaService } from '../plataforma/auditoria.service';
import { NotificacionesService } from '../plataforma/notificaciones.service';
import { TenantService } from './tenant.service';

export type TipoSolicitudTecnica = 'vinculacion_veterinario';
export type EstadoSolicitudTecnica = 'pendiente' | 'aprobada' | 'rechazada' | 'resuelta';

export interface SolicitudTecnicaDoc {
  id: string;
  tipo: TipoSolicitudTecnica;
  estado: EstadoSolicitudTecnica;
  emailInvitado: string;
  uidExistente?: string;
  orgSolicitante: string;
  orgActual?: string;
  rolSolicitado: Exclude<Rol, 'superadmin' | 'asistente'>;
  roleSolicitado?: Exclude<RolV2, 'superadmin'>;
  accountType?: 'vet_individual' | 'veterinaria' | 'entidad';
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  planOwnerType?: 'vet' | 'veterinaria' | 'entidad';
  planOwnerId?: string;
  vinculoTipo?: 'staff' | 'freelance' | 'owner';
  planActual?: Record<string, unknown>;
  motivo?: string;
  conflicto?: string;
  decisionTecnica?: string;
  creadoPor: string;
  resueltoPor?: string;
  invitacionId?: string;
  membershipId?: string;
  creadoEn?: unknown;
  actualizadoEn?: unknown;
  resueltoEn?: unknown;
  auditTrail?: Array<Record<string, unknown>>;
}

export interface CrearSolicitudTecnicaInput
  extends Omit<SolicitudTecnicaDoc, 'id' | 'estado' | 'creadoEn' | 'actualizadoEn' | 'auditTrail'> {
  estado?: EstadoSolicitudTecnica;
}

@Injectable()
export class SolicitudesTecnicasService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly tenant: TenantService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  private get col(): admin.firestore.CollectionReference {
    return this.firebase.firestore.collection(COLLECTIONS.solicitudesTecnicas);
  }

  async crearVinculacion(input: CrearSolicitudTecnicaInput): Promise<SolicitudTecnicaDoc> {
    const existente = await this.buscarPendiente(input.uidExistente, input.orgSolicitante, input.emailInvitado);
    if (existente) return existente;

    const ref = this.col.doc();
    const doc = stripUndefinedFields({
      ...input,
      tipo: 'vinculacion_veterinario',
      estado: 'pendiente',
      membershipId: input.membershipId ?? this.membershipIdSugerido(ref.id, input),
      auditTrail: [
        {
          accion: 'crear',
          actorUid: input.creadoPor,
          fecha: new Date().toISOString(),
          motivo: input.motivo ?? input.conflicto ?? 'conflicto_vinculacion',
        },
      ],
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    }) as Omit<SolicitudTecnicaDoc, 'id'>;

    await ref.set(doc);
    await this.auditoria.registrar({
      accion: 'solicitud_tecnica.crear',
      actorUid: input.creadoPor,
      orgId: input.orgSolicitante,
      recurso: ref.id,
      meta: {
        tipo: 'vinculacion_veterinario',
        uidExistente: input.uidExistente ?? null,
        conflicto: input.conflicto ?? null,
      },
    });
    const creada = { id: ref.id, ...doc };
    await this.notificarCreacion(creada);
    return creada;
  }

  async listar(user: AuthUser, estado?: EstadoSolicitudTecnica): Promise<SolicitudTecnicaDoc[]> {
    let q: admin.firestore.Query = this.col;
    if (!this.esAreaTecnica(user)) {
      if (!user.orgId) return [];
      q = q.where('orgSolicitante', '==', user.orgId);
    }
    const snap = await q.get();
    return snap.docs
      .map((d) => this.fromSnap(d))
      .filter((s) => !estado || s.estado === estado);
  }

  async obtener(id: string, user: AuthUser): Promise<SolicitudTecnicaDoc> {
    const solicitud = await this.obtenerInterna(id);
    this.assertPuedeVer(user, solicitud);
    return solicitud;
  }

  async aprobar(id: string, user: AuthUser, decisionTecnica?: string): Promise<SolicitudTecnicaDoc> {
    this.assertAreaTecnica(user);
    const solicitud = await this.obtenerInterna(id);
    if (solicitud.estado !== 'pendiente') {
      throw new BadRequestException('Solo se pueden aprobar solicitudes pendientes.');
    }

    const miembro = solicitud.roleSolicitado
      ? await this.tenant.asignarMiembroV2({
          uid: this.requireUid(solicitud),
          email: solicitud.emailInvitado,
          orgId: solicitud.orgSolicitante,
          rol: solicitud.rolSolicitado,
          role: solicitud.roleSolicitado,
          accountType: solicitud.accountType ?? 'veterinaria',
          accountId: this.requireField(solicitud.accountId, 'accountId'),
          entidadId: solicitud.entidadId,
          veterinariaId: solicitud.veterinariaId,
          membershipId: solicitud.membershipId,
          planOwnerType: solicitud.planOwnerType ?? 'veterinaria',
          planOwnerId: this.requireField(solicitud.planOwnerId, 'planOwnerId'),
          vinculoTipo: solicitud.vinculoTipo ?? 'staff',
        })
      : await this.tenant.asignarMiembro(
          solicitud.orgSolicitante,
          this.requireUid(solicitud),
          solicitud.rolSolicitado,
        );

    await this.actualizarResolucion(solicitud, 'aprobada', user.uid, decisionTecnica ?? 'Vinculacion aprobada.');
    await this.auditoria.registrar({
      accion: 'solicitud_tecnica.aprobar',
      actorUid: user.uid,
      orgId: solicitud.orgSolicitante,
      recurso: id,
      meta: { uid: solicitud.uidExistente ?? null, membershipId: miembro.membershipId ?? null },
    });
    await this.auditoria.registrar({
      accion: 'claims.aplicar',
      actorUid: user.uid,
      orgId: solicitud.orgSolicitante,
      recurso: this.requireUid(solicitud),
      meta: { solicitudId: id, role: solicitud.roleSolicitado ?? solicitud.rolSolicitado },
    });
    const actualizada = await this.obtenerInterna(id);
    await this.notificarResolucion(actualizada, 'aprobada');
    return actualizada;
  }

  async rechazar(id: string, user: AuthUser, decisionTecnica?: string): Promise<SolicitudTecnicaDoc> {
    this.assertAreaTecnica(user);
    const solicitud = await this.obtenerInterna(id);
    if (solicitud.estado !== 'pendiente') {
      throw new BadRequestException('Solo se pueden rechazar solicitudes pendientes.');
    }
    await this.actualizarResolucion(solicitud, 'rechazada', user.uid, decisionTecnica ?? 'Vinculacion rechazada.');
    await this.auditoria.registrar({
      accion: 'solicitud_tecnica.rechazar',
      actorUid: user.uid,
      orgId: solicitud.orgSolicitante,
      recurso: id,
      meta: { uid: solicitud.uidExistente ?? null },
    });
    const actualizada = await this.obtenerInterna(id);
    await this.notificarResolucion(actualizada, 'rechazada');
    return actualizada;
  }

  async marcarResuelta(id: string, user: AuthUser, decisionTecnica?: string): Promise<SolicitudTecnicaDoc> {
    this.assertAreaTecnica(user);
    const solicitud = await this.obtenerInterna(id);
    if (solicitud.estado === 'pendiente') {
      throw new BadRequestException('Una solicitud pendiente debe aprobarse o rechazarse antes de cerrarla.');
    }
    await this.actualizarResolucion(solicitud, 'resuelta', user.uid, decisionTecnica ?? solicitud.decisionTecnica);
    await this.auditoria.registrar({
      accion: 'solicitud_tecnica.resolver',
      actorUid: user.uid,
      orgId: solicitud.orgSolicitante,
      recurso: id,
      meta: { estadoAnterior: solicitud.estado },
    });
    return this.obtenerInterna(id);
  }

  private async buscarPendiente(
    uidExistente: string | undefined,
    orgSolicitante: string,
    emailInvitado: string,
  ): Promise<SolicitudTecnicaDoc | null> {
    let q = this.col
      .where('tipo', '==', 'vinculacion_veterinario')
      .where('orgSolicitante', '==', orgSolicitante)
      .where('estado', '==', 'pendiente');
    q = uidExistente
      ? q.where('uidExistente', '==', uidExistente)
      : q.where('emailInvitado', '==', emailInvitado);
    const snap = await q.limit(1).get();
    if (snap.empty) return null;
    return this.fromSnap(snap.docs[0]);
  }

  private async obtenerInterna(id: string): Promise<SolicitudTecnicaDoc> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) throw new NotFoundException('Solicitud tecnica no encontrada.');
    return this.fromSnap(snap);
  }

  private async actualizarResolucion(
    solicitud: SolicitudTecnicaDoc,
    estado: EstadoSolicitudTecnica,
    actorUid: string,
    decisionTecnica?: string,
  ): Promise<void> {
    const auditTrail = [
      ...(solicitud.auditTrail ?? []),
      {
        accion: estado,
        actorUid,
        fecha: new Date().toISOString(),
        decisionTecnica: decisionTecnica ?? null,
      },
    ];
    await this.col.doc(solicitud.id).set(
      stripUndefinedFields({
        estado,
        decisionTecnica,
        resueltoPor: actorUid,
        resueltoEn: admin.firestore.FieldValue.serverTimestamp(),
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
        auditTrail,
      }),
      { merge: true },
    );
  }

  private async notificarCreacion(solicitud: SolicitudTecnicaDoc): Promise<void> {
    const dedupeKey = `solicitud_tecnica_creada:${solicitud.id}`;
    await this.notificaciones.crear({
      destinatarioUid: solicitud.creadoPor,
      orgId: solicitud.orgSolicitante,
      tipo: 'solicitud_tecnica_creada',
      titulo: 'Solicitud en revision tecnica',
      cuerpo: 'La vinculacion quedo pendiente de revision por Area Tecnica.',
      resourceType: 'solicitudTecnica',
      resourceId: solicitud.id,
      resourcePath: `${COLLECTIONS.solicitudesTecnicas}/${solicitud.id}`,
      dedupeKey,
    });
    await this.notificaciones.notificarAdminsEntidad(
      solicitud.orgSolicitante,
      'solicitud_tecnica_creada',
      'Solicitud en revision tecnica',
      'Hay una vinculacion de veterinario pendiente de revision tecnica.',
      {
        dedupeKey,
        resourceType: 'solicitudTecnica',
        resourceId: solicitud.id,
        resourcePath: `${COLLECTIONS.solicitudesTecnicas}/${solicitud.id}`,
      },
    );
    await this.notificarAreaTecnica(solicitud, dedupeKey);
  }

  private async notificarResolucion(
    solicitud: SolicitudTecnicaDoc,
    resultado: 'aprobada' | 'rechazada',
  ): Promise<void> {
    const tipo = resultado === 'aprobada' ? 'solicitud_tecnica_aprobada' : 'solicitud_tecnica_rechazada';
    const dedupeKey = `${tipo}:${solicitud.id}`;
    const titulo = resultado === 'aprobada' ? 'Solicitud tecnica aprobada' : 'Solicitud tecnica rechazada';
    const cuerpo =
      resultado === 'aprobada'
        ? 'La vinculacion del veterinario fue aprobada y aplicada.'
        : 'La vinculacion del veterinario fue rechazada por Area Tecnica.';
    await this.notificaciones.crear({
      destinatarioUid: solicitud.creadoPor,
      orgId: solicitud.orgSolicitante,
      tipo,
      titulo,
      cuerpo,
      resourceType: 'solicitudTecnica',
      resourceId: solicitud.id,
      resourcePath: `${COLLECTIONS.solicitudesTecnicas}/${solicitud.id}`,
      dedupeKey,
    });
    if (solicitud.uidExistente) {
      await this.notificaciones.crear({
        destinatarioUid: solicitud.uidExistente,
        orgId: solicitud.orgSolicitante,
        tipo: resultado === 'aprobada' ? 'veterinario_vinculado' : tipo,
        titulo: resultado === 'aprobada' ? 'Vinculacion aprobada' : titulo,
        cuerpo: resultado === 'aprobada' ? 'Tu cuenta fue vinculada a la organizacion solicitante.' : cuerpo,
        resourceType: 'solicitudTecnica',
        resourceId: solicitud.id,
        resourcePath: `${COLLECTIONS.solicitudesTecnicas}/${solicitud.id}`,
        dedupeKey: `${dedupeKey}:vet`,
      });
    }
  }

  private async notificarAreaTecnica(solicitud: SolicitudTecnicaDoc, dedupeKey: string): Promise<void> {
    const snaps = await Promise.all([
      this.firebase.firestore.collection(COLLECTIONS.miembros).where('rol', '==', 'superadmin').get(),
      this.firebase.firestore.collection(COLLECTIONS.miembros).where('role', '==', 'superadmin').get(),
    ]);
    const destinatarios = new Set<string>();
    for (const snap of snaps) {
      for (const doc of snap.docs) {
        const data = doc.data() as Record<string, unknown>;
        destinatarios.add(typeof data.uid === 'string' ? data.uid : doc.id);
      }
    }
    await Promise.all(
      [...destinatarios].map((uid) =>
        this.notificaciones.crear({
          destinatarioUid: uid,
          destinatarioRol: 'superadmin',
          orgId: solicitud.orgSolicitante,
          tipo: 'solicitud_tecnica_creada',
          titulo: 'Nueva solicitud tecnica',
          cuerpo: 'Hay una vinculacion de veterinario para revisar.',
          resourceType: 'solicitudTecnica',
          resourceId: solicitud.id,
          resourcePath: `${COLLECTIONS.solicitudesTecnicas}/${solicitud.id}`,
          dedupeKey: `${dedupeKey}:area:${uid}`,
        }),
      ),
    );
  }

  private assertPuedeVer(user: AuthUser, solicitud: SolicitudTecnicaDoc): void {
    if (this.esAreaTecnica(user)) return;
    if (!user.orgId || user.orgId !== solicitud.orgSolicitante) {
      throw new ForbiddenException('No puedes ver solicitudes de otra organizacion.');
    }
  }

  private assertAreaTecnica(user: AuthUser): void {
    if (!this.esAreaTecnica(user)) {
      throw new ForbiddenException('Solo Area Tecnica puede resolver solicitudes.');
    }
  }

  private esAreaTecnica(user: AuthUser): boolean {
    return user.rol === 'superadmin' || user.role === 'superadmin';
  }

  private requireUid(solicitud: SolicitudTecnicaDoc): string {
    return this.requireField(solicitud.uidExistente, 'uidExistente');
  }

  private requireField(value: string | undefined, field: string): string {
    if (!value) throw new BadRequestException(`${field} requerido para aplicar vinculacion.`);
    return value;
  }

  private membershipIdSugerido(id: string, input: CrearSolicitudTecnicaInput): string {
    const uid = input.uidExistente ?? 'pendiente';
    const role = input.roleSolicitado ?? input.rolSolicitado;
    const scope = input.accountId ?? input.orgSolicitante;
    return `m_${uid}_${role}_${scope}_${id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private fromSnap(
    snap: admin.firestore.DocumentSnapshot | admin.firestore.QueryDocumentSnapshot,
  ): SolicitudTecnicaDoc {
    const d = (snap.data() ?? {}) as Record<string, unknown>;
    return stripUndefinedFields({
      id: snap.id,
      tipo: d.tipo === 'vinculacion_veterinario' ? d.tipo : 'vinculacion_veterinario',
      estado: parseEstado(d.estado),
      emailInvitado: str(d.emailInvitado) ?? '',
      uidExistente: str(d.uidExistente),
      orgSolicitante: str(d.orgSolicitante) ?? '',
      orgActual: str(d.orgActual),
      rolSolicitado: d.rolSolicitado === 'admin' ? 'admin' : 'vet',
      roleSolicitado: parseRoleSolicitado(d.roleSolicitado),
      accountType: parseAccountType(d.accountType),
      accountId: str(d.accountId),
      entidadId: str(d.entidadId),
      veterinariaId: str(d.veterinariaId),
      planOwnerType: parsePlanOwnerType(d.planOwnerType),
      planOwnerId: str(d.planOwnerId),
      vinculoTipo: parseVinculoTipo(d.vinculoTipo),
      planActual: isRecord(d.planActual) ? d.planActual : undefined,
      motivo: str(d.motivo),
      conflicto: str(d.conflicto),
      decisionTecnica: str(d.decisionTecnica),
      creadoPor: str(d.creadoPor) ?? '',
      resueltoPor: str(d.resueltoPor),
      invitacionId: str(d.invitacionId),
      membershipId: str(d.membershipId),
      creadoEn: d.creadoEn,
      actualizadoEn: d.actualizadoEn,
      resueltoEn: d.resueltoEn,
      auditTrail: Array.isArray(d.auditTrail) ? d.auditTrail.filter(isRecord) : undefined,
    }) as SolicitudTecnicaDoc;
  }
}

function parseEstado(value: unknown): EstadoSolicitudTecnica {
  return value === 'aprobada' || value === 'rechazada' || value === 'resuelta'
    ? value
    : 'pendiente';
}

function parseRoleSolicitado(value: unknown): SolicitudTecnicaDoc['roleSolicitado'] {
  return value === 'admin_entidad' || value === 'admin_veterinaria' || value === 'veterinario'
    ? value
    : undefined;
}

function parseAccountType(value: unknown): SolicitudTecnicaDoc['accountType'] {
  return value === 'vet_individual' || value === 'veterinaria' || value === 'entidad'
    ? value
    : undefined;
}

function parsePlanOwnerType(value: unknown): SolicitudTecnicaDoc['planOwnerType'] {
  return value === 'vet' || value === 'veterinaria' || value === 'entidad' ? value : undefined;
}

function parseVinculoTipo(value: unknown): SolicitudTecnicaDoc['vinculoTipo'] {
  return value === 'staff' || value === 'freelance' || value === 'owner' ? value : undefined;
}

function stripUndefinedFields<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
