import { describe, it, expect, vi, beforeEach } from 'vitest';

const { api } = vi.hoisted(() => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../../lib/apiClient', () => ({ apiClient: api }));

import { listarNotificaciones, marcarNotificacionLeida, marcarTodasNotificacionesLeidas } from './api';

describe('notificaciones/api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista notificaciones (todas)', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'n1', titulo: 't', cuerpo: 'c', tipo: 'bienvenida', leida: false }] });
    const res = await listarNotificaciones();
    expect(api.get).toHaveBeenCalledWith('/v1/notificaciones', { params: undefined });
    expect(res).toHaveLength(1);
  });

  it('lista solo no leidas con query param', async () => {
    api.get.mockResolvedValue({ data: [] });
    await listarNotificaciones(true);
    expect(api.get).toHaveBeenCalledWith('/v1/notificaciones', { params: { noLeidas: 'true' } });
  });

  it('marca leida via POST', async () => {
    api.post.mockResolvedValue({ data: { ok: true } });
    await marcarNotificacionLeida('n1');
    expect(api.post).toHaveBeenCalledWith('/v1/notificaciones/n1/leer');
  });

  it('marca todas via POST', async () => {
    api.post.mockResolvedValue({ data: { ok: true, actualizadas: 2 } });
    const res = await marcarTodasNotificacionesLeidas();
    expect(api.post).toHaveBeenCalledWith('/v1/notificaciones/leer-todas');
    expect(res.actualizadas).toBe(2);
  });
});
