import { ForbiddenException, Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { AuthUser } from '../../common/auth/auth-user.interface';

export type TipoNotificacion =
  | 'bienvenida'
  | 'cita_recordatorio'
  | 'vacunas_pendientes'
  | 'consumo_80'
  | 'consumo_100'
  | 'suscripcion_por_vencer'
  | 'suscripcion_vencida'
  | 'suscripcion_bloqueada'
  | 'pago_confirmado'
  | 'cuenta_bloqueada'
  | 'cuenta_suspendida'
  | 'invitacion_expirada'
  | 'invitacion_aceptada'
  | 'solicitud_tecnica_creada'
  | 'solicitud_tecnica_aprobada'
  | 'solicitud_tecnica_rechazada'
  | 'veterinario_vinculado'
  | 'miembro_invitado'
  | 'miembro_activado'
  | 'miembro_desactivado'
  | 'consulta_aprobada'
  | 'pdf_generado';

export interface NotificacionInput {
  destinatarioUid: string;
  orgId?: string | null;
  entidadId?: string | null;
  veterinariaId?: string | null;
  destinatarioRol?: string | null;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  resourceType?: string;
  resourceId?: string;
  resourcePath?: string;
  pacienteId?: string;
  consultaId?: string;
  dedupeKey?: string;
}

export interface NotificarAdminsOptions {
  entidadId?: string | null;
  veterinariaId?: string | null;
  dedupeKey?: string;
  resourceType?: string;
  resourceId?: string;
  resourcePath?: string;
  pacienteId?: string;
  consultaId?: string;
}

// Notificaciones in-app (canal Fase 1 junto al email). Append por el backend; el cliente
// solo lee las suyas y las marca como leidas. (WhatsApp/SMS automaticos = Fase 2, NO aqui).
@Injectable()
export class NotificacionesService {
  constructor(private readonly firebase: FirebaseService) {}

  private get col(): admin.firestore.CollectionReference {
    return this.firebase.firestore.collection(COLLECTIONS.notificaciones);
  }

  async crear(input: NotificacionInput): Promise<{ id: string }> {
    if (input.dedupeKey) {
      const existente = await this.col
        .where('destinatarioUid', '==', input.destinatarioUid)
        .where('dedupeKey', '==', input.dedupeKey)
        .limit(1)
        .get();
      if (!existente.empty) return { id: existente.docs[0].id };
    }
    const ref = this.col.doc();
    await ref.set({
      destinatarioUid: input.destinatarioUid,
      orgId: input.orgId ?? null,
      entidadId: input.entidadId ?? null,
      veterinariaId: input.veterinariaId ?? null,
      destinatarioRol: input.destinatarioRol ?? null,
      tipo: input.tipo,
      titulo: input.titulo,
      cuerpo: input.cuerpo,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      resourcePath: input.resourcePath ?? null,
      pacienteId: input.pacienteId ?? null,
      consultaId: input.consultaId ?? null,
      ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
      leida: false,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: ref.id };
  }

  async listar(user: AuthUser, soloNoLeidas = false): Promise<Record<string, unknown>[]> {
    const snap = await this.col.where('destinatarioUid', '==', user.uid).get();
    const items: Record<string, unknown>[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Record<string, unknown>),
    }));
    return soloNoLeidas ? items.filter((n) => n.leida === false) : items;
  }

  // Notifica admins del scope V2 cuando existe. orgId queda solo como fallback legacy.
  async notificarAdminsEntidad(
    orgId: string | undefined | null,
    tipo: TipoNotificacion,
    titulo: string,
    cuerpo: string,
    options: NotificarAdminsOptions = {},
  ): Promise<void> {
    const entidadId = texto(options.entidadId);
    const veterinariaId = texto(options.veterinariaId);
    if (!orgId && !entidadId && !veterinariaId) return;

    const admins = new Map<string, { rol: string | null; orgId: string | null }>();
    if (entidadId || veterinariaId) {
      const snaps: Array<Awaited<ReturnType<admin.firestore.Query['get']>>> = [];
      if (entidadId) {
        snaps.push(
          await this.firebase.firestore.collection(COLLECTIONS.miembros).where('entidadId', '==', entidadId).get(),
        );
      }
      if (veterinariaId) {
        snaps.push(
          await this.firebase.firestore
            .collection(COLLECTIONS.miembros)
            .where('veterinariaId', '==', veterinariaId)
            .get(),
        );
      }
      for (const snap of snaps) {
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>;
          if (!this.esAdminDelScope(data, entidadId, veterinariaId)) continue;
          admins.set(d.id, { rol: rolMiembro(data), orgId: texto(data.orgId) ?? orgId ?? null });
        }
      }
    } else if (orgId) {
      const legacy = await this.firebase.firestore
        .collection(COLLECTIONS.miembros)
        .where('orgId', '==', orgId)
        .where('rol', '==', 'admin')
        .get();
      const v2Entidad = await this.firebase.firestore
        .collection(COLLECTIONS.miembros)
        .where('orgId', '==', orgId)
        .where('role', '==', 'admin_entidad')
        .get();
      const v2Veterinaria = await this.firebase.firestore
        .collection(COLLECTIONS.miembros)
        .where('orgId', '==', orgId)
        .where('role', '==', 'admin_veterinaria')
        .get();
      for (const snap of [legacy, v2Entidad, v2Veterinaria]) {
        for (const d of snap.docs) {
          const data = d.data() as Record<string, unknown>;
          admins.set(d.id, { rol: rolMiembro(data), orgId: texto(data.orgId) ?? orgId });
        }
      }
    }

    await Promise.all(
      [...admins.entries()].map(([uid, adminInfo]) =>
        this.crear({
          destinatarioUid: uid,
          destinatarioRol: adminInfo.rol,
          orgId: adminInfo.orgId,
          entidadId,
          veterinariaId,
          tipo,
          titulo,
          cuerpo,
          resourceType: options.resourceType,
          resourceId: options.resourceId,
          resourcePath: options.resourcePath,
          pacienteId: options.pacienteId,
          consultaId: options.consultaId,
          dedupeKey: options.dedupeKey ? `${options.dedupeKey}:admin:${uid}` : undefined,
        }),
      ),
    );
  }

  private esAdminDelScope(
    data: Record<string, unknown>,
    entidadId: string | null,
    veterinariaId: string | null,
  ): boolean {
    const rol = rolMiembro(data);
    const miembroEntidadId = texto(data.entidadId);
    const miembroVeterinariaId = texto(data.veterinariaId);

    if (entidadId && (rol === 'admin_entidad' || rol === 'admin') && miembroEntidadId === entidadId) {
      return true;
    }
    if (veterinariaId && rol === 'admin_veterinaria' && miembroVeterinariaId === veterinariaId) {
      return true;
    }
    return false;
  }

  async marcarLeida(id: string, user: AuthUser): Promise<{ ok: true }> {
    const ref = this.col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) return { ok: true };
    if ((snap.data() ?? {}).destinatarioUid !== user.uid) {
      throw new ForbiddenException('No puedes modificar notificaciones de otro usuario.');
    }
    await ref.set({ leida: true }, { merge: true });
    return { ok: true };
  }

  async marcarTodasLeidas(user: AuthUser): Promise<{ ok: true; actualizadas: number }> {
    const snap = await this.col.where('destinatarioUid', '==', user.uid).get();
    let actualizadas = 0;
    await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data() as Record<string, unknown>;
        if (data.leida === true) return;
        await this.col.doc(doc.id).set({ leida: true }, { merge: true });
        actualizadas += 1;
      }),
    );
    return { ok: true, actualizadas };
  }
}

function rolMiembro(data: Record<string, unknown>): string | null {
  return texto(data.role) ?? texto(data.rol) ?? null;
}

function texto(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
