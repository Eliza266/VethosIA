import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../common/firebase/firebase.service';
import { COLLECTIONS } from '../../common/firebase/collections';
import { NotificacionesService } from '../plataforma/notificaciones.service';
import { AuditoriaService } from '../plataforma/auditoria.service';
import { PlanesService } from './planes.service';
import { SuscripcionesService } from './suscripciones.service';
import { AuthUser } from '../../common/auth/auth-user.interface';
import { CobrosService, construirReciboAprobado, ReciboDoc } from './cobros.service';
import { SuscripcionDoc } from './plan.types';
import { PagosConfigService } from './pagos-config.service';
import { planOwnerFromSubscription } from './pagos-plan-owner';

export interface WompiEvent {
  event: string;
  data: { transaction?: WompiTransaction };
  signature: { properties: string[]; checksum: string };
  timestamp: number;
}

export interface WompiTransaction {
  id: string;
  status: 'APPROVED' | 'DECLINED' | 'VOIDED' | 'PENDING' | 'ERROR';
  reference: string;
  amount_in_cents: number;
  currency: string;
}

export interface CheckoutInput {
  planId: string;
  ciclo?: 'mensual' | 'anual';
}

// Integracion con Wompi (Colombia). Dos caras:
//  - checkout: firma de integridad para abrir el widget/redirect de pago.
//  - webhook: validacion de la firma del evento + activacion idempotente de la suscripcion.
@Injectable()
export class WompiService {
  private readonly logger = new Logger(WompiService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly notificaciones: NotificacionesService,
    private readonly planes: PlanesService,
    private readonly subs: SuscripcionesService,
    private readonly cobros: CobrosService,
    private readonly auditoria: AuditoriaService,
    private readonly pagosConfig: PagosConfigService,
  ) {}

  generarIntegridad(
    reference: string,
    amountInCents: number,
    integritySecret: string,
    currency = 'COP',
  ): string {
    const cadena = `${reference}${amountInCents}${currency}${integritySecret}`;
    return createHash('sha256').update(cadena).digest('hex');
  }

  crearCheckout(input: CheckoutInput): {
    reference: string;
    amountInCents: number;
    currency: string;
    publicKey: string;
    signature: string;
  } {
    throw new BadRequestException('Use crearCheckoutSeguro con usuario autenticado.');
  }

  /** Calcula monto, moneda y referencia server-side; no confia en el cliente. */
  async crearCheckoutSeguro(
    user: AuthUser,
    planId: string,
    ciclo: 'mensual' | 'anual' = 'mensual',
  ): Promise<{
    reference: string;
    amountInCents: number;
    currency: string;
    publicKey: string;
    signature: string;
    planId: string;
    subscriptionId: string;
  }> {
    const sub = await this.subs.obtenerDeUsuario(user);
    if (!sub) {
      throw new BadRequestException('No hay suscripcion asociada a tu cuenta.');
    }
    this.subs.assertAccesoSuscripcion(user, sub);

    const plan = await this.planes.obtener(planId);
    if (!plan.activo) {
      throw new BadRequestException('El plan seleccionado no esta activo.');
    }

    const currency = 'COP';
    const montoPesos = ciclo === 'anual' ? plan.precioAnualCOP : plan.precioMensualCOP;
    const amountInCents = montoPesos * 100;
    const reference = sub.id;

    const scope = planOwnerFromSubscription(sub);
    const creds = await this.pagosConfig.requireWompiCredentials(scope);

    return {
      reference,
      amountInCents,
      currency,
      publicKey: creds.publicKey,
      signature: this.generarIntegridad(reference, amountInCents, creds.integritySecret, currency),
      planId,
      subscriptionId: sub.id,
    };
  }

  // Lista los pagos/eventos registrados (para el backoffice del Super Admin).
  async listarPagos(limite = 200): Promise<Record<string, unknown>[]> {
    const snap = await this.firebase.firestore.collection(COLLECTIONS.pagos).limit(limite).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
  }

  async estadoCuenta(user: AuthUser): ReturnType<CobrosService['estadoCuenta']> {
    return this.cobros.estadoCuenta(user);
  }

  // Valida la firma del webhook: checksum = SHA256(valores de properties + timestamp + secret).
  validarFirma(event: WompiEvent, secret: string): boolean {
    if (!secret || !event?.signature?.checksum) return false;
    const valores = (event.signature.properties ?? []).map((p) => this.resolverProp(event, p));
    const cadena = `${valores.join('')}${event.timestamp}${secret}`;
    const calculado = createHash('sha256').update(cadena).digest('hex');
    return this.compararSeguro(calculado, event.signature.checksum);
  }

  // Procesa el webhook de forma IDEMPOTENTE: si la transaccion ya fue procesada, no
  // re-activa. Si esta APPROVED, marca el pago y activa la suscripcion referenciada.
  async procesarWebhook(event: WompiEvent): Promise<{ procesado: boolean; status?: string }> {
    const tx = event.data?.transaction;
    if (!tx?.reference) return { procesado: false };

    const subSnap = await this.firebase.firestore
      .collection(COLLECTIONS.suscripciones)
      .doc(tx.reference)
      .get();
    if (!subSnap.exists) {
      await this.auditarPagoRechazado(tx, 'suscripcion_no_encontrada');
      return { procesado: false };
    }
    const subData = {
      id: tx.reference,
      ...(subSnap.data() as Omit<SuscripcionDoc, 'id'>),
    } as SuscripcionDoc;
    const scope = planOwnerFromSubscription(subData);
    const credRes = await this.pagosConfig.resolveWebhookCredentials(scope);
    if (!credRes.ok) {
      await this.auditarPagoRechazado(tx, credRes.reason);
      return { procesado: false };
    }
    const creds = credRes.credentials;

    if (!this.validarFirma(event, creds.eventsSecret)) {
      await this.auditarPagoRechazado(tx, 'firma_invalida');
      return { procesado: false };
    }

    const pagoRef = this.firebase.firestore.collection(COLLECTIONS.pagos).doc(tx.id);
    const subRef = this.firebase.firestore.collection(COLLECTIONS.suscripciones).doc(tx.reference);
    const reciboRef = this.cobros.refRecibo(tx.id);

    const resultado = await this.firebase.firestore.runTransaction(async (t) => {
      const snap = await t.get(pagoRef);
      if (snap.exists && (snap.data() ?? {}).procesado === true) {
        return { yaProcesado: true as const };
      }
      const subSnapTx = await t.get(subRef);
      const subTx = subSnapTx.exists
        ? ({ id: tx.reference, ...(subSnapTx.data() as Omit<SuscripcionDoc, 'id'>) } as SuscripcionDoc)
        : null;
      t.set(
        pagoRef,
        {
          transactionId: tx.id,
          status: tx.status,
          reference: tx.reference,
          amountInCents: tx.amount_in_cents,
          currency: tx.currency,
          procesado: true,
          actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      let recibo: Omit<ReciboDoc, 'creadoEn'> | null = null;
      if (tx.status === 'APPROVED' && subTx) {
        t.set(subRef, { estado: 'activa' }, { merge: true });
        recibo = construirReciboAprobado(
          {
            transactionId: tx.id,
            reference: tx.reference,
            amountInCents: tx.amount_in_cents,
            currency: tx.currency,
          },
          subTx,
        );
        t.set(
          reciboRef,
          { ...recibo, creadoEn: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        );
      }
      return { yaProcesado: false as const, sub: subTx, recibo };
    });

    if (resultado.yaProcesado) {
      this.logger.log(`Webhook Wompi ${tx.id} ya procesado (idempotente).`);
      return { procesado: false, status: tx.status };
    }

    if (tx.status === 'APPROVED') {
      if (resultado.sub) {
        this.logger.log(`Suscripcion ${tx.reference} activada por pago Wompi.`);
        await this.notificarPagoConfirmado(resultado.sub);
      }
      await this.auditoria.registrar({
        accion: 'pago.aprobado',
        actorUid: 'sistema',
        orgId: resultado.sub?.orgId ?? null,
        recurso: tx.id,
        meta: { reference: tx.reference, amountInCents: tx.amount_in_cents },
      });
      if (resultado.recibo) {
        await this.auditoria.registrar({
          accion: 'recibo.generado',
          actorUid: 'sistema',
          orgId: resultado.sub?.orgId ?? null,
          recurso: resultado.recibo.id,
          meta: { transactionId: tx.id, subscriptionId: tx.reference },
        });
      }
    } else {
      await this.auditarPagoRechazado(tx, tx.status);
    }
    return { procesado: true, status: tx.status };
  }

  // Activa la suscripcion cuya 'reference' coincide (ref = id de suscripcion o referencia guardada).
  private async activarPorReferencia(reference: string): Promise<void> {
    const subRef = this.firebase.firestore.collection(COLLECTIONS.suscripciones).doc(reference);
    const snap = await subRef.get();
    if (!snap.exists) return;
    await subRef.set({ estado: 'activa' }, { merge: true });
    this.logger.log(`Suscripcion ${reference} activada por pago Wompi.`);

    // notificar pago confirmado al titular (entidad -> admins; independiente -> el vet).
    const data = (snap.data() ?? {}) as { orgId?: string; veterinarioId?: string };
    if (data.orgId) {
      await this.notificaciones.notificarAdminsEntidad(
        data.orgId,
        'pago_confirmado',
        'Pago confirmado',
        'Tu pago fue confirmado y la suscripcion quedo activa.',
      );
    } else if (data.veterinarioId) {
      await this.notificaciones.crear({
        destinatarioUid: data.veterinarioId,
        tipo: 'pago_confirmado',
        titulo: 'Pago confirmado',
        cuerpo: 'Tu pago fue confirmado y la suscripcion quedo activa.',
      });
    }
  }

  private async notificarPagoConfirmado(data: { orgId?: string; veterinarioId?: string }): Promise<void> {
    if (data.orgId) {
      await this.notificaciones.notificarAdminsEntidad(
        data.orgId,
        'pago_confirmado',
        'Pago confirmado',
        'Tu pago fue confirmado y la suscripcion quedo activa.',
      );
    } else if (data.veterinarioId) {
      await this.notificaciones.crear({
        destinatarioUid: data.veterinarioId,
        tipo: 'pago_confirmado',
        titulo: 'Pago confirmado',
        cuerpo: 'Tu pago fue confirmado y la suscripcion quedo activa.',
      });
    }
  }

  private async auditarPagoRechazado(
    tx: WompiTransaction | undefined,
    motivo: string,
  ): Promise<void> {
    await this.auditoria.registrar({
      accion: 'pago.rechazado',
      actorUid: 'sistema',
      orgId: null,
      recurso: tx?.id,
      meta: { motivo, reference: tx?.reference, status: tx?.status },
    });
  }

  private resolverProp(event: WompiEvent, path: string): string {
    // path tipo "transaction.status" -> navega event.data.
    const partes = path.split('.');
    let cursor: unknown = event.data;
    for (const p of partes) {
      cursor = (cursor as Record<string, unknown> | undefined)?.[p];
    }
    return cursor == null ? '' : String(cursor);
  }

  // comparacion en tiempo ~constante para no filtrar info por timing.
  private compararSeguro(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
}
