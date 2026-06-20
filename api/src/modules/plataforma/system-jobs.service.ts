import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS, consumoDocId, periodoActual } from '../../common/firebase/collections';
import { EstadoSuscripcion, puedeTransicionarSuscripcion } from '../saas/suscripcion.state';
import { NotificacionesService, TipoNotificacion } from './notificaciones.service';
import { AuditoriaService } from './auditoria.service';
import { calcularEstadoVacuna, EstadoVacuna } from '../vacunas/vacuna.types';
import { SYSTEM_CONFIG, SystemConfig } from './system-config';

export type SystemJobKind =
  | 'suscripcion_por_vencer'
  | 'suscripcion_vencida'
  | 'suscripcion_bloqueada_mora'
  | 'trial_finalizado'
  | 'cita_dia_anterior'
  | 'cita_proximas_2h'
  | 'cita_no_asistio'
  | 'vacuna_proxima'
  | 'vacuna_vencida'
  | 'vacunas_resumen_semanal'
  | 'consumo_80'
  | 'consumo_100'
  | 'consumo_reinicio_mensual'
  | 'invitacion_expirada';

export interface SystemJobEvent {
  id: string;
  kind: SystemJobKind;
  resourceId: string;
  period: string;
  orgId?: string | null;
  entidadId?: string | null;
  veterinariaId?: string | null;
  destinatarioUid?: string | null;
  targetEstado?: EstadoSuscripcion | 'no_asistio';
  meta?: Record<string, unknown>;
}

interface SubscriptionLike {
  id: string;
  estado?: EstadoSuscripcion;
  orgId?: string;
  entidadId?: string;
  veterinariaId?: string;
  veterinarioId?: string;
  planOwnerId?: string;
  limiteHistoriasMes?: number;
  vigenteHasta?: string;
  trialHasta?: string;
}

interface CitaLike {
  id: string;
  estado?: string;
  fecha?: string;
  orgId?: string;
  entidadId?: string;
  veterinariaId?: string;
  veterinarioId?: string;
  pacienteNombre?: string;
  pacienteId?: string;
  consultaId?: string;
}

interface VacunaLike {
  id: string;
  orgId?: string;
  entidadId?: string;
  veterinariaId?: string;
  veterinarioId?: string;
  accountId?: string;
  pacienteId?: string;
  nombre?: string;
  estado?: EstadoVacuna;
  proximaDosis?: string;
  eliminadaEn?: unknown;
}

interface ConsumoLike {
  id: string;
  orgId?: string;
  entidadId?: string;
  veterinariaId?: string;
  veterinarioId?: string;
  scopeId?: string;
  periodo?: string;
  usados?: number;
  limite?: number;
  limiteHistoriasMes?: number;
  bloqueado?: boolean;
}

interface InvitacionLike {
  id: string;
  orgId?: string;
  entidadId?: string;
  veterinariaId?: string;
  email?: string;
  rol?: string;
  role?: string;
  estado?: string;
  exp?: number;
  creadoPor?: string;
  usadaEn?: unknown;
  revocadaEn?: unknown;
  expiradaEn?: unknown;
}

const MS_DIA = 24 * 60 * 60 * 1000;
const MS_HORA = 60 * 60 * 1000;

export function jobEventKey(kind: SystemJobKind, resourceId: string, period: string): string {
  return `${kind}_${resourceId}_${period}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function dayPeriod(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function weekPeriod(fecha: Date): string {
  const start = new Date(Date.UTC(fecha.getUTCFullYear(), 0, 1));
  const day = Math.floor((fecha.getTime() - start.getTime()) / MS_DIA);
  const week = Math.floor(day / 7) + 1;
  return `${fecha.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function previousMonthPeriod(fecha: Date): string {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() - 1, 1));
  return periodoActual(d);
}

export function planificarSuscripcionJobs(
  subs: SubscriptionLike[],
  hoy = new Date(),
  config: SystemConfig = SYSTEM_CONFIG,
): SystemJobEvent[] {
  const eventos: SystemJobEvent[] = [];
  const porVencerHasta = hoy.getTime() + config.suscripcionDiasPorVencer * MS_DIA;
  for (const sub of subs) {
    if (sub.estado === 'cancelada' || sub.estado === 'desactivado') continue;
    const base = {
      resourceId: sub.id,
      orgId: sub.orgId ?? null,
      entidadId: sub.entidadId ?? null,
      veterinariaId: sub.veterinariaId ?? null,
      destinatarioUid: sub.veterinarioId ?? null,
    };
    const vigente = parseDate(sub.vigenteHasta);
    if (sub.estado === 'trial_activa') {
      const trial = parseDate(sub.trialHasta);
      if (trial && trial.getTime() < hoy.getTime()) {
        eventos.push(evento('trial_finalizado', base, dayPeriod(hoy), 'bloqueado_fin_trial'));
        continue;
      }
    }
    if (!vigente) continue;
    if (
      (sub.estado === 'activa' || sub.estado === 'trial_activa') &&
      vigente.getTime() >= hoy.getTime() &&
      vigente.getTime() <= porVencerHasta
    ) {
      eventos.push(evento('suscripcion_por_vencer', base, dayPeriod(vigente), 'por_vencer'));
    }
    if (
      (sub.estado === 'activa' || sub.estado === 'por_vencer' || sub.estado === 'trial_activa') &&
      vigente.getTime() < hoy.getTime()
    ) {
      eventos.push(evento('suscripcion_vencida', base, dayPeriod(hoy), 'vencida'));
    }
    const diasMora = Math.floor((hoy.getTime() - vigente.getTime()) / MS_DIA);
    if (sub.estado === 'vencida' && diasMora >= config.suscripcionDiasGracia) {
      eventos.push(evento('suscripcion_bloqueada_mora', base, dayPeriod(hoy), 'bloqueada_mora'));
    }
  }
  return eventos;
}

export function planificarCitaJobs(
  citas: CitaLike[],
  hoy = new Date(),
  config: SystemConfig = SYSTEM_CONFIG,
): SystemJobEvent[] {
  const eventos: SystemJobEvent[] = [];
  for (const cita of citas) {
    if (cita.estado !== 'programada') continue;
    const fecha = parseDate(cita.fecha);
    if (!fecha) continue;
    const base = {
      resourceId: cita.id,
      orgId: cita.orgId ?? null,
      entidadId: cita.entidadId ?? null,
      veterinariaId: cita.veterinariaId ?? null,
      destinatarioUid: cita.veterinarioId ?? null,
      meta: {
        pacienteNombre: cita.pacienteNombre,
        fecha: cita.fecha,
        pacienteId: cita.pacienteId,
        consultaId: cita.consultaId,
      },
    };
    const diff = fecha.getTime() - hoy.getTime();
    if (diff <= -config.citaDiaAnteriorHoras * MS_HORA) {
      eventos.push(evento('cita_no_asistio', base, dayPeriod(hoy), 'no_asistio'));
      continue;
    }
    if (diff <= 0) continue;
    if (diff <= config.citaProximaHoras * MS_HORA) {
      eventos.push(
        evento(
          'cita_proximas_2h',
          base,
          `${dayPeriod(fecha)}T${String(fecha.getUTCHours()).padStart(2, '0')}`,
        ),
      );
    } else if (isTomorrowUtc(fecha, hoy)) {
      eventos.push(evento('cita_dia_anterior', base, dayPeriod(fecha)));
    }
  }
  return eventos;
}

export function planificarVacunaJobs(
  vacunas: VacunaLike[],
  hoy = new Date(),
  config: SystemConfig = SYSTEM_CONFIG,
): SystemJobEvent[] {
  const eventos: SystemJobEvent[] = [];
  const resumen = new Map<
    string,
    {
      orgId?: string | null;
      entidadId?: string | null;
      veterinariaId?: string | null;
      destinatarioUid?: string | null;
      total: number;
    }
  >();
  for (const vacuna of vacunas) {
    if (vacuna.eliminadaEn) continue;
    const estado = calcularEstadoVacuna(vacuna.proximaDosis, hoy, config.vacunasVentanaProximaDias);
    if (estado === 'al_dia') continue;
    const kind: SystemJobKind = estado === 'vencida' ? 'vacuna_vencida' : 'vacuna_proxima';
    const base = {
      resourceId: vacuna.id,
      orgId: vacuna.orgId ?? null,
      entidadId: vacuna.entidadId ?? null,
      veterinariaId: vacuna.veterinariaId ?? null,
      destinatarioUid: vacuna.veterinarioId ?? null,
      meta: { nombre: vacuna.nombre, pacienteId: vacuna.pacienteId, proximaDosis: vacuna.proximaDosis, estado },
    };
    eventos.push(evento(kind, base, dayPeriod(hoy)));
    const scope = [
      vacuna.entidadId ?? vacuna.orgId ?? vacuna.accountId ?? 'sin_scope',
      vacuna.veterinariaId ?? 'sin_veterinaria',
      vacuna.veterinarioId ?? 'sin_vet',
    ].join(':');
    const prev = resumen.get(scope) ?? {
      orgId: vacuna.orgId ?? null,
      entidadId: vacuna.entidadId ?? null,
      veterinariaId: vacuna.veterinariaId ?? null,
      destinatarioUid: vacuna.veterinarioId ?? null,
      total: 0,
    };
    prev.total += 1;
    resumen.set(scope, prev);
  }
  if (hoy.getUTCDay() !== 1) return eventos;
  for (const [scope, data] of resumen.entries()) {
    eventos.push(
      evento(
        'vacunas_resumen_semanal',
        {
          resourceId: scope,
          orgId: data.orgId ?? null,
          entidadId: data.entidadId ?? null,
          veterinariaId: data.veterinariaId ?? null,
          destinatarioUid: data.destinatarioUid ?? null,
          meta: { total: data.total },
        },
        weekPeriod(hoy),
      ),
    );
  }
  return eventos;
}

export function planificarConsumoJobs(
  consumos: ConsumoLike[],
  hoy = new Date(),
  config: SystemConfig = SYSTEM_CONFIG,
): SystemJobEvent[] {
  const eventos: SystemJobEvent[] = [];
  const periodo = periodoActual(hoy);
  const periodoAnterior = previousMonthPeriod(hoy);
  const esDiaPrimero = hoy.getUTCDate() === 1;
  for (const consumo of consumos) {
    const scopeId = consumo.scopeId ?? consumo.id.replace(/_\d{4}-\d{2}$/, '');
    const limite = numero(consumo.limite ?? consumo.limiteHistoriasMes);
    const usados = numero(consumo.usados);
    const docPeriodo = consumo.periodo ?? extraerPeriodo(consumo.id);
    const destinatarioUid = consumo.veterinarioId ?? uidDesdeScope(scopeId);
    const base = {
      resourceId: consumo.id,
      orgId: consumo.orgId ?? null,
      entidadId: consumo.entidadId ?? null,
      veterinariaId: consumo.veterinariaId ?? null,
      destinatarioUid,
      meta: { scopeId, periodo: docPeriodo, usados, limite },
    };
    if (docPeriodo === periodo && limite > 0) {
      if (usados >= limite) {
        eventos.push(evento('consumo_100', base, periodo));
      } else if (usados >= Math.ceil((limite * config.consumoAlertaPorcentaje) / 100)) {
        eventos.push(evento('consumo_80', base, periodo));
      }
    }
    if (esDiaPrimero && docPeriodo === periodoAnterior) {
      eventos.push(
        evento(
          'consumo_reinicio_mensual',
          {
            ...base,
            meta: { ...base.meta, nuevoPeriodo: periodo, nuevoDocId: consumoDocId(scopeId, periodo) },
          },
          periodo,
        ),
      );
    }
  }
  return eventos;
}

export function planificarInvitacionJobs(
  invitaciones: InvitacionLike[],
  hoy = new Date(),
): SystemJobEvent[] {
  const eventos: SystemJobEvent[] = [];
  for (const invitacion of invitaciones) {
    if (invitacion.estado && invitacion.estado !== 'pendiente') continue;
    if (invitacion.usadaEn || invitacion.revocadaEn || invitacion.expiradaEn) continue;
    if (!invitacion.exp || invitacion.exp > hoy.getTime()) continue;
    eventos.push(
      evento(
        'invitacion_expirada',
        {
          resourceId: invitacion.id,
          orgId: invitacion.orgId ?? null,
          entidadId: invitacion.entidadId ?? null,
          veterinariaId: invitacion.veterinariaId ?? null,
          destinatarioUid: invitacion.creadoPor ?? null,
          meta: { email: invitacion.email, rol: invitacion.rol, role: invitacion.role },
        },
        dayPeriod(hoy),
      ),
    );
  }
  return eventos;
}

@Injectable()
export class SystemJobsService {
  private readonly logger = new Logger(SystemJobsService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly notificaciones: NotificacionesService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async ejecutar(
    hoy = new Date(),
  ): Promise<{
    created: number;
    skipped: number;
    updated: number;
    errors: number;
    events: SystemJobEvent[];
    errorDetails: Array<{ kind: SystemJobKind; resourceType: string; error: string }>;
  }> {
    const [subs, citas, vacunas, consumos, invitaciones] = await Promise.all([
      this.listarColeccion<SubscriptionLike>(COLLECTIONS.suscripciones),
      this.listarColeccion<CitaLike>(COLLECTIONS.citas),
      this.listarColeccion<VacunaLike>(COLLECTIONS.vacunas),
      this.listarColeccion<ConsumoLike>(COLLECTIONS.consumos),
      this.listarColeccion<InvitacionLike>(COLLECTIONS.invitaciones),
    ]);
    const updated = await this.recalcularEstadosVacunas(vacunas, hoy);
    const consumosConLimite = this.enriquecerConsumos(consumos, subs);
    const events = [
      ...planificarSuscripcionJobs(subs, hoy),
      ...planificarCitaJobs(citas, hoy),
      ...planificarVacunaJobs(vacunas, hoy),
      ...planificarConsumoJobs(consumosConLimite, hoy),
      ...planificarInvitacionJobs(invitaciones, hoy),
    ];
    let created = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: Array<{ kind: SystemJobKind; resourceType: string; error: string }> = [];
    for (const event of events) {
      try {
        if (await this.registrarEvento(event)) {
          created += 1;
          await this.aplicarEvento(event);
          await this.marcarEventoAplicado(event);
        } else {
          skipped += 1;
        }
      } catch (err) {
        errors += 1;
        const detail = {
          kind: event.kind,
          resourceType: this.resourceTypeFor(event.kind),
          error: err instanceof Error ? err.message : 'unknown_error',
        };
        errorDetails.push(detail);
        this.logger.warn(`Job interno fallo: kind=${detail.kind} resourceType=${detail.resourceType} error=${detail.error}`);
        await this.auditarError(event, err);
      }
    }
    await this.auditoria.registrar({
      accion: 'job.sistema',
      actorUid: 'sistema',
      orgId: null,
      recurso: `system-jobs:${dayPeriod(hoy)}`,
      meta: { created, skipped, updated, errors, events: events.length },
    });
    return { created, skipped, updated, errors, events, errorDetails };
  }

  private async listarColeccion<T extends { id: string }>(collection: string): Promise<T[]> {
    const snap = await this.firebase.firestore.collection(collection).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<T, 'id'>) }) as T);
  }

  private async recalcularEstadosVacunas(vacunas: VacunaLike[], hoy: Date): Promise<number> {
    let updated = 0;
    for (const vacuna of vacunas) {
      if (vacuna.eliminadaEn) continue;
      const estado = calcularEstadoVacuna(vacuna.proximaDosis, hoy, SYSTEM_CONFIG.vacunasVentanaProximaDias);
      if (vacuna.estado === estado) continue;
      await this.firebase.firestore
        .collection(COLLECTIONS.vacunas)
        .doc(vacuna.id)
        .set({ estado, actualizadoEn: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      updated += 1;
      await this.auditoria.registrar({
        accion: 'job.sistema',
        actorUid: 'sistema',
        orgId: vacuna.orgId ?? null,
        recurso: vacuna.id,
        meta: { kind: 'vacuna_estado_recalculado', estado },
      });
    }
    return updated;
  }

  private enriquecerConsumos(consumos: ConsumoLike[], subs: SubscriptionLike[]): ConsumoLike[] {
    return consumos.map((consumo) => {
      if (consumo.limite !== undefined || consumo.limiteHistoriasMes !== undefined) return consumo;
      const sub = subs.find(
        (s) =>
          (consumo.scopeId && (s.planOwnerId === consumo.scopeId || s.orgId === consumo.scopeId)) ||
          (consumo.entidadId && s.entidadId === consumo.entidadId) ||
          (consumo.veterinariaId && s.veterinariaId === consumo.veterinariaId) ||
          (consumo.veterinarioId && s.veterinarioId === consumo.veterinarioId) ||
          (!consumo.entidadId && !consumo.veterinariaId && consumo.orgId && s.orgId === consumo.orgId),
      );
      return sub?.limiteHistoriasMes ? { ...consumo, limiteHistoriasMes: sub.limiteHistoriasMes } : consumo;
    });
  }

  private async registrarEvento(event: SystemJobEvent): Promise<boolean> {
    const ref = this.firebase.firestore.collection(COLLECTIONS.jobEventos).doc(event.id);
    return this.firebase.firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) return false;
      tx.set(ref, sanitizeFirestorePayload({
        ...event,
        resourceType: this.resourceTypeFor(event.kind),
        resourcePath: this.resourcePathFor(event),
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
      }));
      return true;
    });
  }

  private async marcarEventoAplicado(event: SystemJobEvent): Promise<void> {
    await this.firebase.firestore
      .collection(COLLECTIONS.jobEventos)
      .doc(event.id)
      .set({ aplicadoEn: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }

  private async aplicarEvento(event: SystemJobEvent): Promise<void> {
    if (event.targetEstado && this.esEstadoSuscripcion(event.targetEstado)) {
      await this.aplicarCambioSuscripcion(event, event.targetEstado);
    }
    if (event.kind === 'cita_no_asistio') {
      await this.marcarCitaNoAsistio(event);
    }
    if (event.kind === 'consumo_100') {
      await this.firebase.firestore
        .collection(COLLECTIONS.consumos)
        .doc(event.resourceId)
        .set({ bloqueado: true, bloqueadoEn: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
    if (event.kind === 'consumo_reinicio_mensual') {
      const nuevoDocId = typeof event.meta?.nuevoDocId === 'string' ? event.meta.nuevoDocId : null;
      const nuevoPeriodo = typeof event.meta?.nuevoPeriodo === 'string' ? event.meta.nuevoPeriodo : event.period;
      const scopeId = typeof event.meta?.scopeId === 'string' ? event.meta.scopeId : event.resourceId;
      if (nuevoDocId) {
        const limite = typeof event.meta?.limite === 'number' ? event.meta.limite : undefined;
        const ref = this.firebase.firestore.collection(COLLECTIONS.consumos).doc(nuevoDocId);
        const snap = await ref.get();
        if (!snap.exists) {
          await ref.set(
            {
              scopeId,
              periodo: nuevoPeriodo,
              usados: 0,
              bloqueado: false,
              orgId: event.orgId ?? null,
              entidadId: event.entidadId ?? null,
              veterinariaId: event.veterinariaId ?? null,
              veterinarioId: event.destinatarioUid ?? null,
              ...(limite !== undefined ? { limite } : {}),
              creadoPorJob: true,
            },
            { merge: true },
          );
        }
      }
    }
    if (event.kind === 'invitacion_expirada') {
      await this.expirarInvitacion(event);
    }

    const notification = this.notificacionPara(event);
    const resourceType = this.resourceTypeFor(event.kind);
    const resourcePath = this.resourcePathFor(event);
    const pacienteId = typeof event.meta?.pacienteId === 'string' ? event.meta.pacienteId : undefined;
    const consultaId = typeof event.meta?.consultaId === 'string' ? event.meta.consultaId : undefined;
    if (notification && event.destinatarioUid) {
      await this.notificaciones.crear({
        destinatarioUid: event.destinatarioUid,
        orgId: event.orgId ?? null,
        entidadId: event.entidadId ?? null,
        veterinariaId: event.veterinariaId ?? null,
        ...notification,
        resourceType,
        resourceId: event.resourceId,
        resourcePath,
        pacienteId,
        consultaId,
        dedupeKey: event.id,
      });
    }
    const adminScope = event.orgId || event.entidadId || event.veterinariaId;
    if (notification && adminScope && this.notificarAdminsPara(event.kind)) {
      await this.notificaciones.notificarAdminsEntidad(
        event.orgId ?? null,
        notification.tipo,
        notification.titulo,
        notification.cuerpo,
        {
          entidadId: event.entidadId ?? null,
          veterinariaId: event.veterinariaId ?? null,
          dedupeKey: event.id,
          resourceType,
          resourceId: event.resourceId,
          resourcePath,
          pacienteId,
          consultaId,
        },
      );
    }
    await this.auditarEvento(event);
  }

  private async aplicarCambioSuscripcion(event: SystemJobEvent, targetEstado: EstadoSuscripcion): Promise<void> {
    const ref = this.firebase.firestore.collection(COLLECTIONS.suscripciones).doc(event.resourceId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Suscripcion ${event.resourceId} no existe.`);
    const actual = snap.data() as Record<string, unknown>;
    const estadoActual = typeof actual.estado === 'string' ? actual.estado as EstadoSuscripcion : undefined;
    if (!estadoActual) throw new Error(`Suscripcion ${event.resourceId} sin estado valido.`);
    if (estadoActual === targetEstado) return;
    if (!puedeTransicionarSuscripcion(estadoActual, targetEstado)) {
      throw new Error(`Transicion de suscripcion invalida: ${estadoActual} -> ${targetEstado}.`);
    }
    await ref.set({ estado: targetEstado }, { merge: true });
  }

  private async marcarCitaNoAsistio(event: SystemJobEvent): Promise<void> {
    const ref = this.firebase.firestore.collection(COLLECTIONS.citas).doc(event.resourceId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Cita ${event.resourceId} no existe.`);
    const data = snap.data() as Record<string, unknown>;
    if (data.estado !== 'programada') {
      throw new Error(`Cita ${event.resourceId} no esta programada.`);
    }
    await ref.set({ estado: 'no_asistio' }, { merge: true });
  }

  private async expirarInvitacion(event: SystemJobEvent): Promise<void> {
    const ref = this.firebase.firestore.collection(COLLECTIONS.invitaciones).doc(event.resourceId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Invitacion ${event.resourceId} no existe.`);
    const data = snap.data() as Record<string, unknown>;
    if (data.usadaEn || data.revocadaEn || data.expiradaEn) {
      throw new Error(`Invitacion ${event.resourceId} ya no esta pendiente.`);
    }
    if (typeof data.estado === 'string' && data.estado !== 'pendiente') {
      throw new Error(`Invitacion ${event.resourceId} no esta pendiente.`);
    }
    await ref.set({ expiradaEn: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }

  private async auditarEvento(event: SystemJobEvent): Promise<void> {
    await this.auditoria.registrar({
      accion: 'job.sistema',
      actorUid: 'sistema',
      orgId: event.orgId ?? null,
      recurso: event.id,
      meta: {
        kind: event.kind,
        resourceId: event.resourceId,
        resourceType: this.resourceTypeFor(event.kind),
        period: event.period,
      },
    });
    if (this.esCambioSuscripcion(event.kind)) {
      await this.auditoria.registrar({
        accion: event.kind === 'suscripcion_bloqueada_mora' || event.kind === 'trial_finalizado'
          ? 'cuenta.bloquear'
          : 'suscripcion.cambiar',
        actorUid: 'sistema',
        orgId: event.orgId ?? null,
        recurso: event.resourceId,
        meta: { kind: event.kind, estado: event.targetEstado },
      });
    }
    if (event.kind === 'invitacion_expirada') {
      await this.auditoria.registrar({
        accion: 'invitacion.expirada',
        actorUid: 'sistema',
        orgId: event.orgId ?? null,
        recurso: event.resourceId,
      });
    }
  }

  private async auditarError(event: SystemJobEvent, err: unknown): Promise<void> {
    const error = err instanceof Error ? { name: err.name, message: err.message } : { message: 'unknown_error' };
    await this.auditoria.registrar({
      accion: 'job.sistema',
      actorUid: 'sistema',
      orgId: event.orgId ?? null,
      recurso: event.id,
      meta: { kind: event.kind, resourceId: event.resourceId, error },
    });
  }

  private notificacionPara(
    event: SystemJobEvent,
  ): { tipo: TipoNotificacion; titulo: string; cuerpo: string } | null {
    switch (event.kind) {
      case 'suscripcion_por_vencer':
        return { tipo: 'suscripcion_por_vencer', titulo: 'Suscripcion por vencer', cuerpo: 'Tu suscripcion esta cerca de vencer.' };
      case 'suscripcion_vencida':
        return { tipo: 'suscripcion_vencida', titulo: 'Suscripcion vencida', cuerpo: 'La suscripcion vencio y requiere pago.' };
      case 'suscripcion_bloqueada_mora':
      case 'trial_finalizado':
        return { tipo: 'cuenta_bloqueada', titulo: 'Cuenta bloqueada', cuerpo: 'La cuenta requiere regularizacion para operar.' };
      case 'cita_dia_anterior':
        return { tipo: 'cita_recordatorio', titulo: 'Cita manana', cuerpo: 'Tienes una cita programada para manana.' };
      case 'cita_proximas_2h':
        return { tipo: 'cita_recordatorio', titulo: 'Cita proxima', cuerpo: 'Tienes una cita en las proximas 2 horas.' };
      case 'vacuna_proxima':
      case 'vacuna_vencida':
      case 'vacunas_resumen_semanal':
        return { tipo: 'vacunas_pendientes', titulo: 'Vacunas pendientes', cuerpo: 'Hay vacunas proximas o vencidas para revisar.' };
      case 'consumo_80':
        return { tipo: 'consumo_80', titulo: 'Consumo IA al 80%', cuerpo: 'El consumo de IA llego al 80% del cupo mensual.' };
      case 'consumo_100':
        return { tipo: 'consumo_100', titulo: 'Consumo IA al 100%', cuerpo: 'El cupo mensual de IA fue alcanzado y la generacion queda bloqueada.' };
      case 'invitacion_expirada':
        return { tipo: 'invitacion_expirada', titulo: 'Invitacion expirada', cuerpo: 'Una invitacion supero las 48 horas y fue expirada.' };
      default:
        return null;
    }
  }

  private resourceTypeFor(kind: SystemJobKind): string {
    if (kind.startsWith('suscripcion') || kind === 'trial_finalizado') return 'suscripcion';
    if (kind.startsWith('cita')) return 'cita';
    if (kind.startsWith('vacuna')) return 'vacuna';
    if (kind.startsWith('consumo')) return 'consumo';
    if (kind.startsWith('invitacion')) return 'invitacion';
    return 'sistema';
  }

  private resourcePathFor(event: SystemJobEvent): string {
    const type = this.resourceTypeFor(event.kind);
    const collection =
      type === 'suscripcion'
        ? COLLECTIONS.suscripciones
        : type === 'cita'
          ? COLLECTIONS.citas
          : type === 'vacuna'
            ? COLLECTIONS.vacunas
            : type === 'consumo'
              ? COLLECTIONS.consumos
              : type === 'invitacion'
                ? COLLECTIONS.invitaciones
                : COLLECTIONS.jobEventos;
    return `${collection}/${event.resourceId}`;
  }

  private esEstadoSuscripcion(value: SystemJobEvent['targetEstado']): value is EstadoSuscripcion {
    return value !== undefined && value !== 'no_asistio';
  }

  private esCambioSuscripcion(kind: SystemJobKind): boolean {
    return kind === 'suscripcion_por_vencer' ||
      kind === 'suscripcion_vencida' ||
      kind === 'suscripcion_bloqueada_mora' ||
      kind === 'trial_finalizado';
  }

  private notificarAdminsPara(kind: SystemJobKind): boolean {
    return kind.startsWith('consumo') ||
      kind.startsWith('suscripcion') ||
      kind === 'trial_finalizado' ||
      kind === 'invitacion_expirada';
  }
}

function evento(
  kind: SystemJobKind,
  base: Omit<SystemJobEvent, 'id' | 'kind' | 'period'>,
  period: string,
  targetEstado?: EstadoSuscripcion | 'no_asistio',
): SystemJobEvent {
  const event: SystemJobEvent = {
    ...base,
    kind,
    period,
    id: jobEventKey(kind, base.resourceId, period),
  };
  if (targetEstado !== undefined) event.targetEstado = targetEstado;
  return event;
}

function sanitizeFirestorePayload<T extends Record<string, unknown>>(payload: T): T {
  return omitUndefinedDeep(payload) as T;
}

function omitUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.map(omitUndefinedDeep).filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const sanitized = omitUndefinedDeep(item);
      if (sanitized !== undefined) result[key] = sanitized;
    }
    return result;
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isTomorrowUtc(fecha: Date, hoy: Date): boolean {
  const a = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
  const b = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  return Math.floor((b.getTime() - a.getTime()) / MS_DIA) === 1;
}

function numero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function extraerPeriodo(id: string): string | undefined {
  const match = /_(\d{4}-\d{2})$/.exec(id);
  return match?.[1];
}

function uidDesdeScope(scopeId?: string): string | null {
  if (!scopeId?.startsWith('vet_')) return null;
  return scopeId.slice(4) || null;
}
