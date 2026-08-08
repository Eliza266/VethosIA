import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { SuscripcionDoc, LIMITE_TRIAL_DEFECTO } from './plan.types';
import { EstadoSuscripcion, puedeTransicionarSuscripcion } from './suscripcion.state';
import { AuditoriaService } from '../plataforma/auditoria.service';
import { esSuperadmin } from '../../common/auth/access';
import { canOperatePlanV2, isAuthUserV2 } from '../../common/auth/access-v2';
import {
  obtenerSuscripcionDeUsuario,
  resolverLimiteHistoriasMes,
} from './plan-limits';

@Injectable()
export class SuscripcionesService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private get col(): admin.firestore.CollectionReference {
    return this.firebase.firestore.collection(COLLECTIONS.suscripciones);
  }

  /** Valida que el actor pueda operar sobre la suscripcion (servicio, no solo controller). */
  assertAccesoSuscripcion(actor: AuthUser, sub: SuscripcionDoc): void {
    if (esSuperadmin(actor)) return;
    if (isAuthUserV2(actor)) {
      const planOwnerType = sub.planOwnerType ?? (sub.orgId ? 'entidad' : 'vet');
      const planOwnerId = sub.planOwnerId ?? sub.orgId ?? (sub.veterinarioId ? `vet_${sub.veterinarioId}` : undefined);
      if (
        !canOperatePlanV2(actor, {
          planOwnerType,
          planOwnerId,
          entidadId: sub.entidadId,
          veterinariaId: sub.veterinariaId,
        })
      ) {
        throw new ForbiddenException('No puedes modificar la suscripcion de este plan owner.');
      }
      return;
    }
    if (sub.orgId) {
      if (actor.orgId !== sub.orgId) {
        throw new ForbiddenException('No puedes modificar la suscripcion de otra organizacion.');
      }
      if (actor.rol !== 'admin') {
        throw new ForbiddenException('Solo un admin puede modificar la suscripcion de la entidad.');
      }
      return;
    }
    if (sub.veterinarioId !== actor.uid) {
      throw new ForbiddenException('No puedes modificar la suscripcion de otro veterinario.');
    }
  }

  async obtenerPorId(id: string): Promise<SuscripcionDoc> {
    const snap = await this.col.doc(id).get();
    if (!snap.exists) throw new NotFoundException(`Suscripcion ${id} no existe.`);
    return { id: snap.id, ...(snap.data() as Omit<SuscripcionDoc, 'id'>) };
  }

  async obtenerDeUsuario(user: AuthUser): Promise<SuscripcionDoc | null> {
    return obtenerSuscripcionDeUsuario(this.firebase, user);
  }

  // Limite de historias IA/mes del usuario. Entidad y vet independiente resuelven igual:
  // su suscripcion -> limiteHistoriasMes. Sin suscripcion -> limite de trial por defecto.
  async limiteHistoriasMes(user: AuthUser): Promise<number> {
    return resolverLimiteHistoriasMes(this.firebase, user);
  }

  async cambiarEstado(id: string, nuevo: EstadoSuscripcion, actor?: AuthUser): Promise<SuscripcionDoc> {
    const ref = this.col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException(`Suscripcion ${id} no existe.`);
    const actual = { id: snap.id, ...(snap.data() as Omit<SuscripcionDoc, 'id'>) };
    if (actor) this.assertAccesoSuscripcion(actor, actual);
    if (actual.estado !== nuevo && !puedeTransicionarSuscripcion(actual.estado, nuevo)) {
      throw new BadRequestException(`Transicion de suscripcion invalida: ${actual.estado} -> ${nuevo}.`);
    }
    await ref.set({ estado: nuevo }, { merge: true });
    const esBloqueo = nuevo === 'bloqueada_mora' || nuevo === 'bloqueado_fin_trial' || nuevo === 'desactivado';
    await this.auditoria.registrar({
      accion: esBloqueo ? 'cuenta.bloquear' : 'suscripcion.cambiar',
      actorUid: actor?.uid ?? 'sistema',
      orgId: actual.orgId ?? actor?.orgId ?? null,
      recurso: id,
      meta: { estado: nuevo },
    });
    return { ...actual, id, estado: nuevo };
  }

  // Extiende el trial N dias y reactiva el estado trial (PDF 06.B 'Extender trial').
  async extenderTrial(id: string, dias: number, actor?: AuthUser): Promise<SuscripcionDoc> {
    const ref = this.col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException(`Suscripcion ${id} no existe.`);
    const actual = { id: snap.id, ...(snap.data() as Omit<SuscripcionDoc, 'id'>) };
    if (actor) this.assertAccesoSuscripcion(actor, actual);
    const base = actual.trialHasta ? new Date(actual.trialHasta) : new Date();
    const nuevoHasta = new Date(Math.max(base.getTime(), Date.now()) + dias * 24 * 60 * 60 * 1000);
    await ref.set(
      { trialHasta: nuevoHasta.toISOString(), estado: 'trial_activa' },
      { merge: true },
    );
    await this.auditoria.registrar({
      accion: 'suscripcion.cambiar',
      actorUid: actor?.uid ?? 'sistema',
      orgId: actual.orgId ?? actor?.orgId ?? null,
      recurso: id,
      meta: { extenderTrialDias: dias },
    });
    return { ...actual, id, estado: 'trial_activa', trialHasta: nuevoHasta.toISOString() };
  }

  // Fase 1: el cobro se gestiona por WhatsApp, sin pasarela. Al registrar un pago manual
  // (ver CobrosService.registrarPagoManual), se extiende la vigencia y se reactiva la
  // cuenta (vencida/bloqueada -> activa).
  async extenderVigenciaPorPago(id: string, vigenteHasta: string, actor?: AuthUser): Promise<SuscripcionDoc> {
    const ref = this.col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException(`Suscripcion ${id} no existe.`);
    const actual = { id: snap.id, ...(snap.data() as Omit<SuscripcionDoc, 'id'>) };
    if (actor) this.assertAccesoSuscripcion(actor, actual);
    if (actual.estado === 'cancelada') {
      throw new BadRequestException('Esta suscripcion esta cancelada; no se puede registrar un pago sobre ella.');
    }
    await ref.set({ estado: 'activa', vigenteHasta }, { merge: true });
    await this.auditoria.registrar({
      accion: 'suscripcion.cambiar',
      actorUid: actor?.uid ?? 'sistema',
      orgId: actual.orgId ?? actor?.orgId ?? null,
      recurso: id,
      meta: { pagoManualVigenteHasta: vigenteHasta },
    });
    return { ...actual, id, estado: 'activa', vigenteHasta };
  }

  // Asignar plan manualmente desde Super Admin
  async asignarPlan(id: string, planId: string, actor?: AuthUser): Promise<SuscripcionDoc> {
    const ref = this.col.doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException(`Suscripcion ${id} no existe.`);
    const actual = { id: snap.id, ...(snap.data() as Omit<SuscripcionDoc, 'id'>) };
    if (actor) this.assertAccesoSuscripcion(actor, actual);

    // Buscar plan en la colección 'planes' para tomar nombre, asientos y límite de historias
    const planSnap = await this.firebase.firestore.collection(COLLECTIONS.planes).doc(planId).get();
    const planData = planSnap.exists ? (planSnap.data() as Record<string, unknown>) : null;
    const planNombre = typeof planData?.nombre === 'string' ? planData.nombre : planId;
    const asientosMax = typeof planData?.asientosMax === 'number' ? planData.asientosMax : (actual.asientosMax ?? 1);
    const limiteHistoriasMes = typeof planData?.limiteHistoriasMes === 'number' ? planData.limiteHistoriasMes : (actual.limiteHistoriasMes ?? 50);

    const updatePayload = {
      planId,
      planNombre,
      asientosMax,
      limiteHistoriasMes,
      actualizadoEn: new Date().toISOString(),
    };

    await ref.set(updatePayload, { merge: true });

    await this.auditoria.registrar({
      accion: 'suscripcion.cambiar',
      actorUid: actor?.uid ?? 'sistema',
      orgId: actual.orgId ?? actor?.orgId ?? null,
      recurso: id,
      meta: { planId, planNombre },
    });

    return { ...actual, id, ...updatePayload };
  }

  // Asientos: un alta de miembro no puede exceder asientosMax del plan de la entidad.
  // Para vet independiente no aplica herencia de asientos (asientosMax efectivo = 1).
  async asientosDisponibles(user: AuthUser): Promise<{ usados: number; max: number; libres: number }> {
    const sub = await this.obtenerDeUsuario(user);
    const esPlanCompartido = Boolean(user.orgId || (user.planOwnerType && user.planOwnerType !== 'vet'));
    const max = esPlanCompartido ? (sub?.asientosMax ?? 1) : 1;
    let usados = 0;
    if (user.planOwnerId && user.planOwnerType) {
      const snap = await this.firebase.firestore
        .collection(COLLECTIONS.miembros)
        .where('planOwnerId', '==', user.planOwnerId)
        .get();
      usados = snap.size;
    } else if (user.orgId) {
      const snap = await this.firebase.firestore.collection(COLLECTIONS.miembros).where('orgId', '==', user.orgId).get();
      usados = snap.size;
    } else {
      usados = 1;
    }
    return { usados, max, libres: Math.max(0, max - usados) };
  }

  async puedeAgregarMiembro(user: AuthUser): Promise<boolean> {
    if (!user.orgId && user.planOwnerType !== 'veterinaria' && user.planOwnerType !== 'entidad') return false;
    return (await this.asientosDisponibles(user)).libres > 0;
  }
}
