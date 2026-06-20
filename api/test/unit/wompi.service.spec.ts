import { createHash } from 'crypto';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { WompiService, WompiEvent, WompiTransaction } from '../../src/modules/saas/wompi.service';
import { PlanesService } from '../../src/modules/saas/planes.service';
import { SuscripcionesService } from '../../src/modules/saas/suscripciones.service';
import { CobrosService } from '../../src/modules/saas/cobros.service';
import { PagosConfigService } from '../../src/modules/saas/pagos-config.service';
import { TenantSecretsService } from '../../src/modules/saas/tenant-secrets.service';
import { fakeFirebase } from './saas.fakes';
import { seedWompiForPlanOwner } from './pagos-test-helpers';
import { AuthUser } from '../../src/common/auth/auth-user.interface';

const fakeNotis = () =>
  ({
    crear: jest.fn().mockResolvedValue({ id: 'n' }),
    notificarAdminsEntidad: jest.fn().mockResolvedValue(undefined),
  }) as never;

function buildWompi(seedConfig = true) {
  const { fb, fs } = fakeFirebase();
  const tenantSecrets = new TenantSecretsService();
  const planes = {
    obtener: jest.fn(async (id: string) => ({
      id,
      nombre: 'Pro',
      precioMensualCOP: 990,
      precioAnualCOP: 9900,
      activo: true,
      asientosMax: 5,
      limiteHistoriasMes: 100,
      historiasGratisTrial: 0,
      tipo: 'entidad' as const,
    })),
  } as unknown as PlanesService;
  const subs = {
    obtenerDeUsuario: jest.fn(async () => ({
      id: 'sub-1',
      orgId: 'orgA',
      planId: 'plan-pro',
      estado: 'trial_activa' as const,
    })),
    assertAccesoSuscripcion: jest.fn(),
  } as unknown as SuscripcionesService;
  const auditoria = { registrar: jest.fn().mockResolvedValue({ id: 'audit' }) };
  const cobros = new CobrosService(fb, subs);
  const pagosConfig = new PagosConfigService(fb, tenantSecrets, auditoria as never);
  if (seedConfig) seedWompiForPlanOwner(fs, tenantSecrets, 'orgA');
  const svc = new WompiService(fb, fakeNotis(), planes, subs, cobros, auditoria as never, pagosConfig);
  return { svc, fs, planes, subs, auditoria, tenantSecrets, pagosConfig };
}

function firmar(event: Omit<WompiEvent, 'signature'>, props: string[], secret: string): WompiEvent {
  const tx = event.data.transaction as WompiTransaction;
  const resolver = (p: string): string => {
    const map: Record<string, unknown> = {
      'transaction.id': tx.id,
      'transaction.status': tx.status,
      'transaction.amount_in_cents': tx.amount_in_cents,
    };
    return String(map[p] ?? '');
  };
  const cadena = `${props.map(resolver).join('')}${event.timestamp}${secret}`;
  const checksum = createHash('sha256').update(cadena).digest('hex');
  return { ...event, signature: { properties: props, checksum } };
}

function evento(status: WompiTransaction['status'], reference = 'sub-1', secret = 'test_events_secret'): WompiEvent {
  const base = {
    event: 'transaction.updated',
    data: { transaction: { id: 'txn_1', status, reference, amount_in_cents: 99000, currency: 'COP' } },
    timestamp: 1736900000,
  };
  return firmar(base, ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], secret);
}

const user: AuthUser = { uid: 'u1', orgId: 'orgA', rol: 'admin' };

describe('WompiService', () => {
  it('valida una firma correcta', () => {
    const { svc } = buildWompi();
    expect(svc.validarFirma(evento('APPROVED'), 'test_events_secret')).toBe(true);
  });

  it('rechaza una firma manipulada', () => {
    const { svc } = buildWompi();
    const ev = evento('APPROVED');
    ev.signature.checksum = 'deadbeef';
    expect(svc.validarFirma(ev, 'test_events_secret')).toBe(false);
  });

  it('webhook con firma invalida no procesa', async () => {
    const { svc, fs, auditoria } = buildWompi();
    fs.store.set('suscripciones/sub-1', { estado: 'vencida', orgId: 'orgA' });
    const ev = evento('APPROVED');
    ev.signature.checksum = 'malo';
    const res = await svc.procesarWebhook(ev);
    expect(res.procesado).toBe(false);
    expect([...fs.store.keys()].filter((k) => k.startsWith('recibos/'))).toHaveLength(0);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'pago.rechazado' }),
    );
  });

  it('webhook sin config valida no activa ni genera recibo', async () => {
    const { svc, fs, auditoria } = buildWompi(false);
    fs.store.set('suscripciones/sub-1', { estado: 'vencida', orgId: 'orgA' });
    const res = await svc.procesarWebhook(evento('APPROVED'));
    expect(res.procesado).toBe(false);
    expect(fs.store.get('suscripciones/sub-1')).toMatchObject({ estado: 'vencida' });
    expect([...fs.store.keys()].filter((k) => k.startsWith('recibos/'))).toHaveLength(0);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'pago.rechazado', meta: expect.objectContaining({ motivo: 'pagos_no_configurados' }) }),
    );
  });

  it('APPROVED valido activa la suscripcion, genera recibo y es idempotente', async () => {
    const { svc, fs, auditoria } = buildWompi();
    fs.store.set('suscripciones/sub-1', { estado: 'vencida', orgId: 'orgA' });
    const r1 = await svc.procesarWebhook(evento('APPROVED', 'sub-1'));
    expect(r1.procesado).toBe(true);
    expect(fs.store.get('suscripciones/sub-1')).toMatchObject({ estado: 'activa' });
    expect(fs.store.get('recibos/txn_1')).toMatchObject({
      transactionId: 'txn_1',
      subscriptionId: 'sub-1',
      amountInCents: 99000,
      tipo: 'recibo_fase1_no_fiscal',
      estado: 'emitido',
    });
    const r2 = await svc.procesarWebhook(evento('APPROVED', 'sub-1'));
    expect(r2.procesado).toBe(false);
    expect([...fs.store.keys()].filter((k) => k.startsWith('recibos/'))).toHaveLength(1);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'pago.aprobado', recurso: 'txn_1' }),
    );
  });

  it('DECLINED valido no genera recibo y audita pago rechazado', async () => {
    const { svc, fs, auditoria } = buildWompi();
    fs.store.set('suscripciones/sub-1', { estado: 'activa', orgId: 'orgA' });
    const res = await svc.procesarWebhook(evento('DECLINED', 'sub-1'));
    expect(res).toMatchObject({ procesado: true, status: 'DECLINED' });
    expect([...fs.store.keys()].filter((k) => k.startsWith('recibos/'))).toHaveLength(0);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'pago.rechazado', recurso: 'txn_1' }),
    );
  });

  it('checkout seguro calcula monto desde el plan (ignora cliente)', async () => {
    const { svc, subs } = buildWompi();
    const out = await svc.crearCheckoutSeguro(user, 'plan-pro', 'mensual');
    expect(out.reference).toBe('sub-1');
    expect(out.amountInCents).toBe(990 * 100);
    expect(subs.assertAccesoSuscripcion).toHaveBeenCalled();
    const esperado = createHash('sha256').update(`sub-1${99000}COPpriv`).digest('hex');
    expect(out.signature).toBe(esperado);
  });

  it('checkout sin provider configurado devuelve error controlado', async () => {
    const { svc } = buildWompi(false);
    await expect(svc.crearCheckoutSeguro(user, 'plan-pro', 'mensual')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('checkout seguro rechaza plan inexistente', async () => {
    const { svc, planes } = buildWompi();
    (planes.obtener as jest.Mock).mockRejectedValue(new BadRequestException('Plan x no existe.'));
    await expect(svc.crearCheckoutSeguro(user, 'plan-falso', 'mensual')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('checkout sin suscripcion falla', async () => {
    const { svc, subs } = buildWompi();
    (subs.obtenerDeUsuario as jest.Mock).mockResolvedValue(null);
    await expect(svc.crearCheckoutSeguro(user, 'plan-pro', 'mensual')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
