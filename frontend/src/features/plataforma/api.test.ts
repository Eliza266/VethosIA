import { describe, expect, it, vi, beforeEach } from 'vitest';

const { api } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('../../lib/apiClient', () => ({
  apiClient: api,
}));

describe('plataforma/api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lee configuracion segura de sistema por /v1', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        defaults: { consumoAlertaPorcentaje: 80 },
        integrations: { whatsapp: { mode: 'safe_link_only', realApiEnabled: false } },
        notes: [],
      },
    });

    const result = await import('./api').then((m) => m.obtenerConfiguracionPlataforma());

    expect(api.get).toHaveBeenCalledWith('/v1/sistema/configuracion');
    expect(result.integrations.whatsapp.realApiEnabled).toBe(false);
  });
});
