import { describe, it, expect, vi, beforeEach } from 'vitest';

const { api } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../lib/apiClient', () => ({ apiClient: api }));

import { crearCheckout, estadoCuentaPagos } from './api';

describe('saas api — checkout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('envía planId y ciclo sin monto ni referencia al backend', async () => {
    api.post.mockResolvedValue({
      data: {
        reference: 'sub1',
        amountInCents: 4900000,
        currency: 'COP',
        publicKey: 'pk',
        signature: 'sig',
        planId: 'plan-pro',
        subscriptionId: 'sub1',
      },
    });

    const chk = await crearCheckout({ planId: 'plan-pro', ciclo: 'anual' });

    expect(api.post).toHaveBeenCalledWith('/v1/pagos/checkout', {
      planId: 'plan-pro',
      ciclo: 'anual',
    });
    const payload = api.post.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('amountInCents');
    expect(payload).not.toHaveProperty('reference');
    expect(chk.signature).toBe('sig');
    expect(chk.planId).toBe('plan-pro');
  });

  it('permite omitir ciclo (default server-side mensual)', async () => {
    api.post.mockResolvedValue({
      data: {
        reference: 'sub1',
        amountInCents: 49000,
        currency: 'COP',
        publicKey: 'pk',
        signature: 'sig',
        planId: 'plan-basic',
        subscriptionId: 'sub1',
      },
    });

    await crearCheckout({ planId: 'plan-basic' });

    expect(api.post).toHaveBeenCalledWith('/v1/pagos/checkout', { planId: 'plan-basic' });
  });

  it('descarta campos manipulados antes de llamar checkout', async () => {
    api.post.mockResolvedValue({
      data: {
        reference: 'sub1',
        amountInCents: 49000,
        currency: 'COP',
        publicKey: 'pk',
        signature: 'sig',
        planId: 'plan-basic',
        subscriptionId: 'sub1',
      },
    });

    await crearCheckout({
      planId: 'plan-basic',
      ciclo: 'mensual',
      amountInCents: 1,
      reference: 'evil',
    } as unknown as Parameters<typeof crearCheckout>[0]);

    expect(api.post).toHaveBeenCalledWith('/v1/pagos/checkout', {
      planId: 'plan-basic',
      ciclo: 'mensual',
    });
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('amountInCents');
    expect(api.post.mock.calls[0][1]).not.toHaveProperty('reference');
  });

  it('consulta cartera y recibos de la cuenta autenticada', async () => {
    api.get.mockResolvedValue({
      data: {
        cartera: { estado: 'al_dia', diasVencido: 0, requierePago: false },
        recibos: [{ id: 'txn-1', amountInCents: 99000 }],
      },
    });

    const res = await estadoCuentaPagos();

    expect(api.get).toHaveBeenCalledWith('/v1/pagos/me');
    expect(res.recibos).toHaveLength(1);
    expect(res.cartera.estado).toBe('al_dia');
  });
});
