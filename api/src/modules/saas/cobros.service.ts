import { BadRequestException, Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { SuscripcionDoc } from './plan.types';
import { SuscripcionesService } from './suscripciones.service';

export type EstadoCartera =
  | 'al_dia'
  | 'pendiente'
  | 'vencido_1_30'
  | 'vencido_31_60'
  | 'vencido_60_mas'
  | 'bloqueado';

export interface CarteraCuenta {
  estado: EstadoCartera;
  diasVencido: number;
  vencimiento?: string;
  requierePago: boolean;
}

export interface ReciboDoc {
  id: string;
  transactionId: string;
  subscriptionId: string;
  reference: string;
  amountInCents: number;
  currency: string;
  estado: 'emitido';
  tipo: 'recibo_fase1_no_fiscal' | 'recibo_manual';
  orgId?: string | null;
  veterinarioId?: string | null;
  planId?: string | null;
  fechaEmision: string;
  medioPago?: string | null;
  creadoEn?: unknown;
}

export interface PagoAprobadoInput {
  transactionId: string;
  reference: string;
  amountInCents: number;
  currency: string;
}

export interface RegistrarPagoManualInput {
  amountInCents: number;
  medioPago: string;
  fechaPago?: string;
  referencia?: string;
  extenderCiclo?: 'mensual' | 'anual';
}

export function diasVencidos(vencimiento: string | undefined | null, hoy = new Date()): number {
  if (!vencimiento) return 0;
  const fecha = new Date(vencimiento);
  if (Number.isNaN(fecha.getTime())) return 0;
  const diff = hoy.getTime() - fecha.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

export function clasificarCartera(
  sub: Pick<SuscripcionDoc, 'estado' | 'vigenteHasta'> | null | undefined,
  hoy = new Date(),
): CarteraCuenta {
  if (!sub) {
    return { estado: 'pendiente', diasVencido: 0, requierePago: true };
  }
  if (sub.estado === 'bloqueada_mora' || sub.estado === 'bloqueado_fin_trial' || sub.estado === 'desactivado') {
    return {
      estado: 'bloqueado',
      diasVencido: diasVencidos(sub.vigenteHasta, hoy),
      vencimiento: sub.vigenteHasta,
      requierePago: true,
    };
  }
  if (sub.estado === 'vencida') {
    const dias = diasVencidos(sub.vigenteHasta, hoy);
    if (dias <= 0) {
      return { estado: 'pendiente', diasVencido: 0, vencimiento: sub.vigenteHasta, requierePago: true };
    }
    if (dias <= 30) {
      return { estado: 'vencido_1_30', diasVencido: dias, vencimiento: sub.vigenteHasta, requierePago: true };
    }
    if (dias <= 60) {
      return { estado: 'vencido_31_60', diasVencido: dias, vencimiento: sub.vigenteHasta, requierePago: true };
    }
    return { estado: 'vencido_60_mas', diasVencido: dias, vencimiento: sub.vigenteHasta, requierePago: true };
  }
  if (sub.estado === 'por_vencer') {
    return { estado: 'pendiente', diasVencido: 0, vencimiento: sub.vigenteHasta, requierePago: true };
  }
  return {
    estado: 'al_dia',
    diasVencido: 0,
    vencimiento: sub.vigenteHasta,
    requierePago: false,
  };
}

export function construirReciboAprobado(
  pago: PagoAprobadoInput,
  sub: Pick<SuscripcionDoc, 'id' | 'orgId' | 'veterinarioId' | 'planId'>,
  ahora = new Date(),
): Omit<ReciboDoc, 'creadoEn'> {
  return {
    id: pago.transactionId,
    transactionId: pago.transactionId,
    subscriptionId: sub.id,
    reference: pago.reference,
    amountInCents: pago.amountInCents,
    currency: pago.currency,
    estado: 'emitido',
    tipo: 'recibo_fase1_no_fiscal',
    orgId: sub.orgId ?? null,
    veterinarioId: sub.veterinarioId ?? null,
    planId: sub.planId ?? null,
    fechaEmision: ahora.toISOString(),
  };
}

@Injectable()
export class CobrosService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly subs: SuscripcionesService,
  ) {}

  async estadoCuenta(user: AuthUser): Promise<{ cartera: CarteraCuenta; recibos: ReciboDoc[] }> {
    const sub = await this.subs.obtenerDeUsuario(user);
    if (!sub) {
      return { cartera: clasificarCartera(null), recibos: [] };
    }
    this.subs.assertAccesoSuscripcion(user, sub);
    return {
      cartera: clasificarCartera(sub),
      recibos: await this.listarRecibos(sub.id),
    };
  }

  async listarRecibos(subscriptionId: string, limite = 12): Promise<ReciboDoc[]> {
    const snap = await this.firebase.firestore
      .collection(COLLECTIONS.recibos)
      .where('subscriptionId', '==', subscriptionId)
      .get();
    return snap.docs
      .map((d) => this.fromSnap(d))
      .sort((a, b) => b.fechaEmision.localeCompare(a.fechaEmision))
      .slice(0, limite);
  }

  refRecibo(id: string): admin.firestore.DocumentReference {
    return this.firebase.firestore.collection(COLLECTIONS.recibos).doc(id);
  }

  // Fase 1: Eliza cobra por WhatsApp (efectivo, transferencia, Nequi, etc.), sin pasarela
  // activa. Esto deja constancia del pago (fecha + medio) y, si se indica el ciclo, extiende
  // la vigencia del plan y reactiva la cuenta -- sin esperar a integrar un cobro automatico.
  async registrarPagoManual(
    subscriptionId: string,
    input: RegistrarPagoManualInput,
    actor: AuthUser,
  ): Promise<{ suscripcion: SuscripcionDoc; recibo: ReciboDoc }> {
    const sub = await this.subs.obtenerPorId(subscriptionId);
    this.subs.assertAccesoSuscripcion(actor, sub);
    if (sub.estado === 'cancelada') {
      throw new BadRequestException('Esta suscripcion esta cancelada; no se puede registrar un pago sobre ella.');
    }

    const fechaEmision = input.fechaPago ? new Date(input.fechaPago) : new Date();
    if (Number.isNaN(fechaEmision.getTime())) {
      throw new BadRequestException('Fecha de pago invalida.');
    }

    const reciboId = `manual_${subscriptionId}_${Date.now()}`;
    const recibo: ReciboDoc = {
      id: reciboId,
      transactionId: reciboId,
      subscriptionId,
      reference: input.referencia?.trim() || `Pago manual (${input.medioPago})`,
      amountInCents: input.amountInCents,
      currency: 'COP',
      estado: 'emitido',
      tipo: 'recibo_manual',
      orgId: sub.orgId ?? null,
      veterinarioId: sub.veterinarioId ?? null,
      planId: sub.planId ?? null,
      fechaEmision: fechaEmision.toISOString(),
      medioPago: input.medioPago,
    };
    await this.refRecibo(reciboId).set({
      ...recibo,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });

    let suscripcion = sub;
    if (input.extenderCiclo) {
      const base = sub.vigenteHasta ? new Date(sub.vigenteHasta) : fechaEmision;
      const desde = base.getTime() > fechaEmision.getTime() ? base : fechaEmision;
      const nuevoHasta = new Date(desde);
      if (input.extenderCiclo === 'anual') {
        nuevoHasta.setFullYear(nuevoHasta.getFullYear() + 1);
      } else {
        nuevoHasta.setMonth(nuevoHasta.getMonth() + 1);
      }
      suscripcion = await this.subs.extenderVigenciaPorPago(subscriptionId, nuevoHasta.toISOString(), actor);
    }

    return { suscripcion, recibo };
  }

  fromSnap(
    snap: admin.firestore.DocumentSnapshot | admin.firestore.QueryDocumentSnapshot,
  ): ReciboDoc {
    const d = (snap.data() ?? {}) as Record<string, unknown>;
    const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    return {
      id: snap.id,
      transactionId: str(d.transactionId) ?? snap.id,
      subscriptionId: str(d.subscriptionId) ?? '',
      reference: str(d.reference) ?? '',
      amountInCents: num(d.amountInCents),
      currency: str(d.currency) ?? 'COP',
      estado: 'emitido',
      tipo: d.tipo === 'recibo_manual' ? 'recibo_manual' : 'recibo_fase1_no_fiscal',
      orgId: str(d.orgId) ?? null,
      veterinarioId: str(d.veterinarioId) ?? null,
      planId: str(d.planId) ?? null,
      fechaEmision: str(d.fechaEmision) ?? '',
      medioPago: str(d.medioPago) ?? null,
      creadoEn: d.creadoEn,
    };
  }
}
