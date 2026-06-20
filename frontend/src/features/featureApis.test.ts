import { describe, it, expect, vi, beforeEach } from 'vitest';

const { api } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../lib/apiClient', () => ({ apiClient: api }));

import { listarCitas, crearCita, cambiarEstadoCita } from './citas/api';
import { listarVacunasPaciente, crearVacuna, vacunasPendientes } from './vacunas/api';
import { listarPlanes, extenderTrial, crearCheckout } from './saas/api';
import { crearInvitacion, aceptarInvitacion, listarMiembros, setBloqueoMiembro } from './tenant/api';

describe('feature API layers (/v1)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('citas: list/crear/cambiarEstado pegan a /v1/citas', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'c1' }] });
    api.post.mockResolvedValue({ data: { id: 'c1', estado: 'programada' } });
    api.patch.mockResolvedValue({ data: { id: 'c1', estado: 'realizada' } });
    expect(await listarCitas()).toHaveLength(1);
    await crearCita({ motivo: 'Control', fecha: '2026-07-01T10:00:00Z', pacienteId: 'p1' });
    expect(api.post).toHaveBeenCalledWith(
      '/v1/citas',
      expect.objectContaining({ motivo: 'Control', pacienteId: 'p1' }),
    );
    await cambiarEstadoCita('c1', 'realizada');
    expect(api.patch).toHaveBeenCalledWith('/v1/citas/c1/estado', { estado: 'realizada' });
  });

  it('vacunas: por paciente + pendientes', async () => {
    api.get.mockResolvedValueOnce({ data: [{ id: 'v1' }] });
    expect(await listarVacunasPaciente('p1')).toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith('/v1/pacientes/p1/vacunas');
    api.post.mockResolvedValue({ data: { id: 'v2' } });
    await crearVacuna({ pacienteId: 'p1', nombre: 'Rabia' });
    expect(api.post).toHaveBeenCalledWith('/v1/pacientes/p1/vacunas', { nombre: 'Rabia' });
    api.get.mockResolvedValueOnce({ data: { proximas: 3 } });
    expect(await vacunasPendientes()).toBe(3);
  });

  it('saas: planes, extender trial, checkout', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'plan1' }] });
    expect(await listarPlanes()).toHaveLength(1);
    api.post.mockResolvedValue({ data: { ok: true } });
    await extenderTrial('sub1', 10);
    expect(api.post).toHaveBeenCalledWith('/v1/suscripciones/sub1/extender-trial', { dias: 10 });
    api.post.mockResolvedValueOnce({
      data: {
        reference: 'sub1',
        signature: 's',
        amountInCents: 1000,
        currency: 'COP',
        publicKey: 'pk',
        planId: 'plan1',
        subscriptionId: 'sub1',
      },
    });
    const chk = await crearCheckout({ planId: 'plan1', ciclo: 'mensual' });
    expect(api.post).toHaveBeenCalledWith('/v1/pagos/checkout', { planId: 'plan1', ciclo: 'mensual' });
    expect(chk.signature).toBe('s');
  });

  it('tenant: invitacion crear/aceptar, miembros listar/bloquear', async () => {
    api.post.mockResolvedValueOnce({ data: { token: 'tok', expiraEn: 'x' } });
    expect((await crearInvitacion('orgA', 'a@b.com', 'vet')).token).toBe('tok');
    api.post.mockResolvedValueOnce({ data: { orgId: 'orgA', rol: 'vet' } });
    expect((await aceptarInvitacion('tok')).orgId).toBe('orgA');
    api.get.mockResolvedValue({ data: [{ uid: 'u1', rol: 'vet', bloqueado: false }] });
    expect(await listarMiembros('orgA')).toHaveLength(1);
    api.patch.mockResolvedValue({ data: {} });
    await setBloqueoMiembro('orgA', 'u1', true);
    expect(api.patch).toHaveBeenCalledWith('/v1/organizaciones/orgA/miembros/u1/bloqueo', { bloqueado: true });
  });
});
