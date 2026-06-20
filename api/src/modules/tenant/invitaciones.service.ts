import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { TenantService } from './tenant.service';
import { SuscripcionesService } from '../saas/suscripciones.service';
import { suscripcionPermiteIa } from '../saas/suscripcion.state';
import { NotificacionesService } from '../plataforma/notificaciones.service';
import { AuditoriaService } from '../plataforma/auditoria.service';
import { SolicitudesTecnicasService } from './solicitudes-tecnicas.service';
import { DEV_INVITE_SECRET, MIN_INVITE_SECRET_LENGTH } from '../../common/config/env.schema';
import {
  AccountTypeV2,
  AuthUser,
  PlanOwnerTypeV2,
  Rol,
  RolV2,
  VinculoTipoV2,
} from '../../common/auth/auth-user.interface';

type RolLegacyInvitable = Exclude<Rol, 'superadmin' | 'asistente'>;
type RolInvitacionV2 = Exclude<RolV2, 'superadmin'>;

interface PayloadInvitacion {
  id: string;
  orgId: string;
  email: string;
  rol: Rol;
  exp: number;
}

interface InvitacionDoc {
  orgId: string;
  email: string;
  rol: Rol;
  role?: RolInvitacionV2;
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  vinculoTipo?: VinculoTipoV2;
  exp: number;
  creadoPor: string;
  usadaEn?: admin.firestore.Timestamp;
  usadaPor?: string;
  revocadaEn?: admin.firestore.Timestamp;
  revocadaPor?: string;
  expiradaEn?: admin.firestore.Timestamp;
  estado?: 'pendiente' | 'aceptada' | 'rechazada' | 'revision_tecnica';
  solicitudTecnicaId?: string;
}

interface AceptarInvitacionClienteNoConfiable {
  role?: unknown;
  rol?: unknown;
  accountId?: unknown;
  entidadId?: unknown;
  veterinariaId?: unknown;
  planOwnerId?: unknown;
}

interface InvitacionAceptada {
  orgId: string;
  rol: Rol;
  role?: RolInvitacionV2;
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  vinculoTipo?: VinculoTipoV2;
}

interface InvitacionPendienteRevisionTecnica {
  estado: 'pendiente_revision_tecnica';
  solicitudTecnicaId: string;
  mensaje: string;
  orgId: string;
  rol: Rol;
  role?: RolInvitacionV2;
}

export type AceptarInvitacionResultado = InvitacionAceptada | InvitacionPendienteRevisionTecnica;

export interface CrearInvitacionV2Input {
  email: string;
  role: RolInvitacionV2;
  orgId?: string;
  entidadId?: string;
  veterinariaId?: string;
  accountId?: string;
  accountType?: AccountTypeV2;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  vinculoTipo?: VinculoTipoV2;
}

// Invitaciones persistidas, one-time-use, expirables y revocables. El token es opaco
// (id + firma HMAC); el estado vive en Firestore para evitar reutilizacion.
@Injectable()
export class InvitacionesService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly tenant: TenantService,
    private readonly subs: SuscripcionesService,
    private readonly solicitudesTecnicas: SolicitudesTecnicasService,
    private readonly notificaciones: NotificacionesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private get secret(): string {
    const configured = process.env.INVITE_SECRET;
    if (process.env.NODE_ENV === 'production') {
      if (!configured || configured.trim().length === 0) {
        throw new Error('INVITE_SECRET obligatorio en produccion.');
      }
      if (configured === DEV_INVITE_SECRET) {
        throw new Error('INVITE_SECRET no puede usar el valor default de desarrollo en produccion.');
      }
      if (configured.length < MIN_INVITE_SECRET_LENGTH) {
        throw new Error('INVITE_SECRET demasiado corto en produccion (min 32 chars).');
      }
    }
    return configured && configured.length > 0 ? configured : DEV_INVITE_SECRET;
  }

  private get ttlMs(): number {
    return Number(process.env.INVITE_TTL_HORAS ?? 48) * 60 * 60 * 1000;
  }

  private firmar(payloadB64: string): string {
    return createHmac('sha256', this.secret).update(payloadB64).digest('base64url');
  }

  private empaquetarToken(payload: PayloadInvitacion): string {
    const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${b64}.${this.firmar(b64)}`;
  }

  private parsearToken(token: string): PayloadInvitacion {
    const [b64, firma] = token.split('.');
    if (!b64 || !firma) throw new BadRequestException('Invitacion mal formada.');
    const esperada = this.firmar(b64);
    const a = Buffer.from(firma);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invitacion con firma invalida.');
    }
    return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as PayloadInvitacion;
  }

  private normalizarEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async crear(
    orgId: string,
    email: string,
    rol: Rol,
    invitador: AuthUser,
  ): Promise<{ token: string; expiraEn: string; invitacionId: string }> {
    void this.secret;
    this.assertRolLegacyInvitable(rol);
    if (invitador.orgId !== orgId && invitador.rol !== 'superadmin') {
      throw new ForbiddenException('Solo puedes invitar a tu propia organizacion.');
    }
    const disponibles = await this.subs.asientosDisponibles({ ...invitador, orgId } as AuthUser);
    if (disponibles.libres <= 0) {
      throw new BadRequestException('No hay asientos disponibles en el plan de la entidad.');
    }

    const exp = Date.now() + this.ttlMs;
    const emailNorm = this.normalizarEmail(email);
    const ref = this.firebase.firestore.collection(COLLECTIONS.invitaciones).doc();
    const doc: InvitacionDoc = {
      orgId,
      email: emailNorm,
      rol,
      exp,
      creadoPor: invitador.uid,
    };
    await ref.set({
      ...doc,
      estado: 'pendiente',
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    const token = this.empaquetarToken({ id: ref.id, orgId, email: emailNorm, rol, exp });
    await this.auditoria.registrar({
      accion: 'invitacion.crear',
      actorUid: invitador.uid,
      orgId,
      recurso: ref.id,
      meta: { email: emailNorm, rol },
    });
    await this.notificaciones.notificarAdminsEntidad(
      orgId,
      'miembro_invitado',
      'Invitacion creada',
      `Se creo una invitacion para ${emailNorm}.`,
      {
        dedupeKey: `miembro_invitado:${ref.id}`,
        resourceType: 'invitacion',
        resourceId: ref.id,
        resourcePath: `${COLLECTIONS.invitaciones}/${ref.id}`,
      },
    );
    return { token, expiraEn: new Date(exp).toISOString(), invitacionId: ref.id };
  }

  async crearV2(
    input: CrearInvitacionV2Input,
    invitador: AuthUser,
  ): Promise<{ token: string; expiraEn: string; invitacionId: string }> {
    void this.secret;
    const scope = await this.scopeInvitacionV2(input, invitador);
    const disponibles = await this.subs.asientosDisponibles({
      ...invitador,
      orgId: scope.orgId,
      accountType: scope.accountType,
      accountId: scope.accountId,
      entidadId: scope.entidadId,
      veterinariaId: scope.veterinariaId,
      planOwnerType: scope.planOwnerType,
      planOwnerId: scope.planOwnerId,
    } as AuthUser);
    if (disponibles.libres <= 0) {
      throw new BadRequestException('No hay asientos disponibles en el plan de la cuenta.');
    }

    const exp = Date.now() + this.ttlMs;
    const emailNorm = this.normalizarEmail(input.email);
    const ref = this.firebase.firestore.collection(COLLECTIONS.invitaciones).doc();
    const doc: InvitacionDoc = {
      orgId: scope.orgId,
      email: emailNorm,
      rol: scope.rol,
      role: scope.role,
      accountType: scope.accountType,
      accountId: scope.accountId,
      entidadId: scope.entidadId,
      veterinariaId: scope.veterinariaId,
      planOwnerType: scope.planOwnerType,
      planOwnerId: scope.planOwnerId,
      vinculoTipo: scope.vinculoTipo,
      exp,
      creadoPor: invitador.uid,
    };
    await ref.set({
      ...doc,
      estado: 'pendiente',
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    const token = this.empaquetarToken({
      id: ref.id,
      orgId: doc.orgId,
      email: emailNorm,
      rol: doc.rol,
      exp,
    });
    await this.auditoria.registrar({
      accion: 'invitacion.crear',
      actorUid: invitador.uid,
      orgId: doc.orgId,
      recurso: ref.id,
      meta: { email: emailNorm, rol: doc.rol, role: doc.role, veterinariaId: doc.veterinariaId },
    });
    await this.notificaciones.notificarAdminsEntidad(
      doc.orgId,
      'miembro_invitado',
      'Invitacion creada',
      `Se creo una invitacion para ${emailNorm}.`,
      {
        dedupeKey: `miembro_invitado:${ref.id}`,
        resourceType: 'invitacion',
        resourceId: ref.id,
        resourcePath: `${COLLECTIONS.invitaciones}/${ref.id}`,
      },
    );
    return { token, expiraEn: new Date(exp).toISOString(), invitacionId: ref.id };
  }

  async revocar(token: string, invitador: AuthUser): Promise<{ revocada: true }> {
    const payload = this.parsearToken(token);
    const ref = this.firebase.firestore.collection(COLLECTIONS.invitaciones).doc(payload.id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException('Invitacion no encontrada.');
    const data = snap.data() as InvitacionDoc;
    if (invitador.orgId !== data.orgId && invitador.rol !== 'superadmin') {
      throw new ForbiddenException('Solo puedes revocar invitaciones de tu organizacion.');
    }
    if (data.usadaEn) {
      throw new BadRequestException('La invitacion ya fue utilizada.');
    }
    if (data.revocadaEn) {
      return { revocada: true };
    }
    await ref.set(
      {
        estado: 'rechazada',
        revocadaEn: admin.firestore.FieldValue.serverTimestamp(),
        revocadaPor: invitador.uid,
      },
      { merge: true },
    );
    await this.auditoria.registrar({
      accion: 'invitacion.revocar',
      actorUid: invitador.uid,
      orgId: data.orgId,
      recurso: payload.id,
    });
    return { revocada: true };
  }

  verificar(token: string): PayloadInvitacion {
    const payload = this.parsearToken(token);
    if (Date.now() > payload.exp) {
      throw new ForbiddenException('La invitacion expiro.');
    }
    return payload;
  }

  async aceptar(
    token: string,
    user: AuthUser,
    _cliente?: AceptarInvitacionClienteNoConfiable,
  ): Promise<AceptarInvitacionResultado> {
    const payload = this.verificar(token);
    const emailUsuario = user.email ? this.normalizarEmail(user.email) : null;
    if (!emailUsuario || emailUsuario !== payload.email) {
      throw new ForbiddenException('El email de tu cuenta no coincide con la invitacion.');
    }

    const { invitacion, doc } = await this.leerInvitacionValida(payload);
    if (doc.estado === 'revision_tecnica' && doc.solicitudTecnicaId) {
      return this.respuestaRevisionTecnica(invitacion, doc.solicitudTecnicaId);
    }

    const conflicto = await this.detectarConflictoVinculacion(user);
    if (conflicto) {
      const solicitud = await this.solicitudesTecnicas.crearVinculacion({
        tipo: 'vinculacion_veterinario',
        emailInvitado: payload.email,
        uidExistente: user.uid,
        orgSolicitante: invitacion.orgId,
        orgActual: conflicto.orgActual,
        rolSolicitado: invitacion.rol === 'admin' ? 'admin' : 'vet',
        roleSolicitado: invitacion.role,
        accountType: invitacion.accountType,
        accountId: invitacion.accountId,
        entidadId: invitacion.entidadId,
        veterinariaId: invitacion.veterinariaId,
        planOwnerType: invitacion.planOwnerType,
        planOwnerId: invitacion.planOwnerId,
        vinculoTipo: invitacion.vinculoTipo,
        planActual: conflicto.planActual,
        motivo: conflicto.motivo,
        conflicto: conflicto.conflicto,
        creadoPor: doc.creadoPor,
        invitacionId: payload.id,
      });
      await this.firebase.firestore.collection(COLLECTIONS.invitaciones).doc(payload.id).set(
        {
          estado: 'revision_tecnica',
          solicitudTecnicaId: solicitud.id,
          revisionTecnicaEn: admin.firestore.FieldValue.serverTimestamp(),
          revisionTecnicaUid: user.uid,
        },
        { merge: true },
      );
      return this.respuestaRevisionTecnica(invitacion, solicitud.id);
    }

    await this.marcarInvitacionUsada(payload, user.uid);

    const miembro = invitacion.role
      ? await this.tenant.asignarMiembroV2({
          uid: user.uid,
          email: user.email ?? null,
          orgId: invitacion.orgId,
          rol: invitacion.rol === 'admin' ? 'admin' : 'vet',
          role: invitacion.role,
          accountType: invitacion.accountType ?? 'veterinaria',
          accountId: invitacion.accountId ?? invitacion.veterinariaId ?? invitacion.orgId,
          entidadId: invitacion.entidadId,
          veterinariaId: invitacion.veterinariaId,
          planOwnerType: invitacion.planOwnerType ?? 'entidad',
          planOwnerId: invitacion.planOwnerId ?? invitacion.entidadId ?? invitacion.orgId,
          vinculoTipo: invitacion.vinculoTipo,
        })
      : await this.tenant.asignarMiembro(invitacion.orgId, user.uid, invitacion.rol);
    await this.auditoria.registrar({
      accion: 'invitacion.aceptar',
      actorUid: user.uid,
      orgId: invitacion.orgId,
      recurso: payload.id,
    });
    await this.notificaciones.notificarAdminsEntidad(
      invitacion.orgId,
      'invitacion_aceptada',
      'Nuevo veterinario activo',
      `${user.email ?? user.uid} acepto la invitacion y se unio a la entidad.`,
      {
        dedupeKey: `invitacion_aceptada:${payload.id}`,
        resourceType: 'invitacion',
        resourceId: payload.id,
        resourcePath: `${COLLECTIONS.invitaciones}/${payload.id}`,
      },
    );
    return {
      ...invitacion,
      orgId: miembro.orgId,
      rol: miembro.rol,
    };
  }

  private async leerInvitacionValida(
    payload: PayloadInvitacion,
  ): Promise<{ invitacion: InvitacionAceptada; doc: InvitacionDoc }> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.invitaciones).doc(payload.id).get();
    if (!snap.exists) throw new ForbiddenException('Invitacion no encontrada.');
    const doc = snap.data() as InvitacionDoc;
    const invitacion = this.validarInvitacionPersistida(payload, doc);
    return { invitacion, doc };
  }

  private async marcarInvitacionUsada(payload: PayloadInvitacion, uid: string): Promise<void> {
    const ref = this.firebase.firestore.collection(COLLECTIONS.invitaciones).doc(payload.id);
    await this.firebase.firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new ForbiddenException('Invitacion no encontrada.');
      this.validarInvitacionPersistida(payload, snap.data() as InvitacionDoc);
      tx.set(
        ref,
        {
          estado: 'aceptada',
          usadaEn: admin.firestore.FieldValue.serverTimestamp(),
          usadaPor: uid,
        },
        { merge: true },
      );
    });
  }

  private validarInvitacionPersistida(payload: PayloadInvitacion, data: InvitacionDoc): InvitacionAceptada {
    const rol = this.validarRolLegacyPersistido(data.rol);
    const role = this.validarRoleV2Persistido((data as { role?: unknown }).role);
    if (data.orgId !== payload.orgId || data.email !== payload.email || rol !== payload.rol) {
      throw new ForbiddenException('Invitacion manipulada.');
    }
    if (data.revocadaEn || data.estado === 'rechazada') {
      throw new ForbiddenException('La invitacion fue revocada.');
    }
    if (data.usadaEn || data.estado === 'aceptada') {
      throw new BadRequestException('La invitacion ya fue utilizada.');
    }
    if (data.expiradaEn || Date.now() > data.exp) {
      throw new ForbiddenException('La invitacion expiro.');
    }
    return {
      orgId: data.orgId,
      rol,
      role,
      accountType: data.accountType,
      accountId: data.accountId,
      entidadId: data.entidadId,
      veterinariaId: data.veterinariaId,
      planOwnerType: data.planOwnerType,
      planOwnerId: data.planOwnerId,
      vinculoTipo: data.vinculoTipo,
    };
  }

  private respuestaRevisionTecnica(
    invitacion: InvitacionAceptada,
    solicitudTecnicaId: string,
  ): InvitacionPendienteRevisionTecnica {
    return {
      estado: 'pendiente_revision_tecnica',
      solicitudTecnicaId,
      mensaje: 'La vinculacion quedo pendiente de revision por Area Tecnica.',
      orgId: invitacion.orgId,
      rol: invitacion.rol,
      role: invitacion.role,
    };
  }

  private async detectarConflictoVinculacion(user: AuthUser): Promise<{
    orgActual?: string;
    planActual?: Record<string, unknown>;
    motivo: string;
    conflicto: string;
  } | null> {
    const [legacy, membership, suscripcion] = await Promise.all([
      this.tenant.obtenerMiembro(user.uid).catch(() => null),
      this.tenant.obtenerMembershipV2(user.uid, user.membershipId).catch(() => null),
      this.subs.obtenerDeUsuario(user).catch(() => null),
    ]);
    const orgActual =
      membership?.orgId ??
      legacy?.orgId ??
      user.orgId ??
      membership?.accountId ??
      legacy?.accountId ??
      user.accountId ??
      user.planOwnerId;
    const tieneOrganizacion = Boolean(orgActual);
    const tienePlanActivo = Boolean(suscripcion?.estado && suscripcionPermiteIa(suscripcion.estado));
    if (!tieneOrganizacion && !tienePlanActivo) return null;

    const motivos = [
      tieneOrganizacion ? 'usuario_con_organizacion' : null,
      tienePlanActivo ? 'usuario_con_plan_activo' : null,
    ].filter(Boolean);
    return {
      orgActual,
      planActual: suscripcion
        ? {
            id: suscripcion.id,
            planId: suscripcion.planId,
            estado: suscripcion.estado,
            orgId: suscripcion.orgId,
            veterinarioId: suscripcion.veterinarioId,
            planOwnerType: suscripcion.planOwnerType,
            planOwnerId: suscripcion.planOwnerId,
          }
        : undefined,
      motivo: motivos.join(','),
      conflicto:
        tieneOrganizacion && tienePlanActivo
          ? 'El usuario ya pertenece a una organizacion y tiene un plan activo.'
          : tieneOrganizacion
            ? 'El usuario ya pertenece a una organizacion.'
            : 'El usuario tiene un plan activo.',
    };
  }

  private assertRolLegacyInvitable(rol: Rol): asserts rol is RolLegacyInvitable {
    if (rol !== 'admin' && rol !== 'vet') {
      throw new BadRequestException('Rol de invitacion no permitido.');
    }
  }

  private validarRolLegacyPersistido(rol: unknown): RolLegacyInvitable {
    if (rol === 'admin' || rol === 'vet') return rol;
    throw new ForbiddenException('Invitacion con rol no permitido.');
  }

  private validarRoleV2Persistido(role: unknown): RolInvitacionV2 | undefined {
    if (role === undefined) return undefined;
    if (role === 'admin_entidad' || role === 'admin_veterinaria' || role === 'veterinario') {
      return role;
    }
    throw new ForbiddenException('Invitacion con rol V2 no permitido.');
  }

  private async scopeInvitacionV2(
    input: CrearInvitacionV2Input,
    invitador: AuthUser,
  ): Promise<InvitacionAceptada> {
    if (!input.role || input.role === 'admin_entidad') {
      throw new BadRequestException('Este flujo solo vincula usuarios al scope de una veterinaria.');
    }

    if (invitador.role === 'admin_veterinaria') {
      if (!invitador.veterinariaId || !invitador.accountId) {
        throw new ForbiddenException('El admin veterinaria no tiene scope de veterinaria.');
      }
      if (input.role !== 'veterinario') {
        throw new ForbiddenException('Admin Veterinaria solo puede invitar veterinarios.');
      }
      return {
        orgId: invitador.orgId ?? input.orgId ?? invitador.veterinariaId,
        rol: 'vet',
        role: 'veterinario',
        accountType: 'veterinaria',
        accountId: invitador.accountId,
        entidadId: invitador.entidadId,
        veterinariaId: invitador.veterinariaId,
        planOwnerType: invitador.planOwnerType ?? 'veterinaria',
        planOwnerId: invitador.planOwnerId ?? invitador.veterinariaId,
        vinculoTipo: input.vinculoTipo ?? 'staff',
      };
    }

    if (invitador.role === 'admin_entidad' || invitador.rol === 'superadmin') {
      if (invitador.role === 'admin_entidad') {
        if (input.role !== 'veterinario') {
          throw new ForbiddenException('Admin Entidad solo puede invitar veterinarios.');
        }
        const entidadId = invitador.entidadId ?? (invitador.accountType === 'entidad' ? invitador.accountId : undefined);
        if (input.accountType === 'entidad' || input.vinculoTipo === 'freelance') {
          return this.scopeFreelanceEntidad(input, invitador, entidadId);
        }
        return this.scopeVeterinariaEntidad(input, invitador, entidadId);
      }

      if (!input.veterinariaId || !input.accountId) {
        throw new BadRequestException('veterinariaId/accountId requeridos para invitacion V2.');
      }
      return {
        orgId: input.orgId ?? invitador.orgId ?? input.entidadId ?? input.veterinariaId,
        rol: input.role === 'admin_veterinaria' ? 'admin' : 'vet',
        role: input.role,
        accountType: input.accountType ?? 'veterinaria',
        accountId: input.accountId,
        entidadId: input.entidadId,
        veterinariaId: input.veterinariaId,
        planOwnerType: input.planOwnerType ?? 'veterinaria',
        planOwnerId: input.planOwnerId ?? input.veterinariaId,
        vinculoTipo: input.vinculoTipo ?? (input.role === 'admin_veterinaria' ? 'owner' : 'staff'),
      };
    }

    throw new ForbiddenException('No tienes permiso para crear invitaciones V2.');
  }

  private async scopeVeterinariaEntidad(
    input: CrearInvitacionV2Input,
    invitador: AuthUser,
    entidadId?: string,
  ): Promise<InvitacionAceptada> {
    if (!input.veterinariaId || !input.accountId) {
      throw new BadRequestException('veterinariaId/accountId requeridos para invitacion a sede.');
    }
    const vet = await this.tenant.obtenerVeterinaria(input.veterinariaId);
    if (!vet) throw new NotFoundException('Veterinaria no encontrada.');
    if (entidadId) {
      if (vet.entidadId !== entidadId) {
        throw new ForbiddenException('La sede no pertenece a tu entidad.');
      }
    } else if (!invitador.orgId || (vet.orgId !== invitador.orgId && vet.legacyOrgId !== invitador.orgId)) {
      throw new ForbiddenException('La sede no pertenece a tu organizacion legacy.');
    }
    if (input.accountId !== vet.accountId && input.accountId !== vet.id) {
      throw new BadRequestException('accountId debe coincidir con la sede.');
    }
    if (input.entidadId && entidadId && input.entidadId !== entidadId) {
      throw new ForbiddenException('La invitacion intenta usar otra entidad.');
    }
    const orgId = this.orgIdSeguro(input.orgId, invitador, vet.orgId ?? vet.legacyOrgId ?? entidadId ?? vet.id);
    return {
      orgId,
      rol: 'vet',
      role: 'veterinario',
      accountType: 'veterinaria',
      accountId: vet.accountId,
      entidadId: vet.entidadId ?? entidadId,
      veterinariaId: vet.id,
      planOwnerType: vet.planOwnerType,
      planOwnerId: vet.planOwnerId,
      vinculoTipo: 'staff',
    };
  }

  private scopeFreelanceEntidad(
    input: CrearInvitacionV2Input,
    invitador: AuthUser,
    entidadId?: string,
  ): InvitacionAceptada {
    if (!entidadId) {
      throw new ForbiddenException('Admin Entidad requiere entidadId para invitar freelance directo.');
    }
    if (input.accountType !== 'entidad') {
      throw new BadRequestException('Freelance directo requiere accountType=entidad.');
    }
    if (input.accountId && input.accountId !== entidadId) {
      throw new ForbiddenException('La invitacion intenta usar otra cuenta entidad.');
    }
    if (input.entidadId && input.entidadId !== entidadId) {
      throw new ForbiddenException('La invitacion intenta usar otra entidad.');
    }
    if (input.planOwnerType && input.planOwnerType !== 'entidad') {
      throw new BadRequestException('Freelance directo requiere planOwnerType=entidad.');
    }
    if (input.planOwnerId && input.planOwnerId !== entidadId) {
      throw new ForbiddenException('La invitacion intenta usar otro plan owner.');
    }
    const orgId = this.orgIdSeguro(input.orgId, invitador, entidadId);
    return {
      orgId,
      rol: 'vet',
      role: 'veterinario',
      accountType: 'entidad',
      accountId: entidadId,
      entidadId,
      planOwnerType: 'entidad',
      planOwnerId: entidadId,
      vinculoTipo: 'freelance',
    };
  }

  private orgIdSeguro(inputOrgId: string | undefined, invitador: AuthUser, fallback: string): string {
    if (inputOrgId && invitador.orgId && inputOrgId !== invitador.orgId) {
      throw new ForbiddenException('La invitacion intenta usar otra organizacion.');
    }
    return invitador.orgId ?? inputOrgId ?? fallback;
  }
}
