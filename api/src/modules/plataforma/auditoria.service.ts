import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { esSuperadmin } from '../../common/auth/access';

export type AccionAuditada =
  | 'login'
  | 'logout'
  | 'paciente.crear'
  | 'paciente.editar'
  | 'paciente.eliminar'
  | 'paciente.vincularConsulta'
  | 'soap.inicio'
  | 'historia.aprobar'
  | 'historia.editar_borrador'
  | 'historia.enmienda'
  | 'pdf.exportar'
  | 'plan.cambiar'
  | 'pago.aprobado'
  | 'pago.rechazado'
  | 'pagos.wompi.configurado'
  | 'pagos.wompi.deshabilitado'
  | 'recibo.generado'
  | 'suscripcion.cambiar'
  | 'cuenta.bloquear'
  | 'cuenta.desbloquear'
  | 'job.sistema'
  | 'invitacion.crear'
  | 'invitacion.aceptar'
  | 'invitacion.revocar'
  | 'invitacion.expirada'
  | 'solicitud_tecnica.crear'
  | 'solicitud_tecnica.aprobar'
  | 'solicitud_tecnica.rechazar'
  | 'solicitud_tecnica.resolver'
  | 'claims.aplicar'
  | 'entidad.crear'
  | 'entidad.editar'
  | 'organizacion.editar'
  | 'veterinaria.crear'
  | 'veterinaria.editar'
  | 'veterinario.crear_credenciales'
  | 'cuenta.autoregistro'
  | 'brigada.crear'
  | 'brigada.editar'
  | 'brigada.atencion_crear'
  | 'miembro.activar'
  | 'miembro.desactivar'
  | 'email.historial';

export interface RegistroAuditoria {
  accion: AccionAuditada;
  actorUid: string;
  orgId?: string | null;
  recurso?: string;
  meta?: Record<string, unknown>;
}

const DOCE_MESES_MS = 365 * 24 * 60 * 60 * 1000;

// Auditoria append-only. Cada accion critica deja {actor, orgId, recurso, timestamp} con
// retencion >= 12 meses (campo retencionHasta para limpieza futura). Solo el backend escribe.
@Injectable()
export class AuditoriaService {
  constructor(private readonly firebase: FirebaseService) {}

  async registrar(reg: RegistroAuditoria, ahora: Date = new Date()): Promise<{ id: string }> {
    const ref = this.firebase.firestore.collection(COLLECTIONS.auditoria).doc();
    await ref.set({
      accion: reg.accion,
      actorUid: reg.actorUid,
      orgId: reg.orgId ?? null,
      recurso: reg.recurso ?? null,
      meta: reg.meta ?? {},
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      retencionHasta: new Date(ahora.getTime() + DOCE_MESES_MS).toISOString(),
    });
    return { id: ref.id };
  }

  // Lectura: superadmin ve todo; admin ve su org. (vet/asistente: limitado, no listan).
  async listar(user: AuthUser, limite = 200): Promise<Record<string, unknown>[]> {
    let q: admin.firestore.Query = this.firebase.firestore.collection(COLLECTIONS.auditoria);
    if (!esSuperadmin(user)) {
      if (!user.orgId) return [];
      q = q.where('orgId', '==', user.orgId);
    }
    const snap = await q.limit(limite).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  }
}
