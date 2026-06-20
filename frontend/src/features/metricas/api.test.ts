import { describe, it, expect, vi, beforeEach } from 'vitest';

const { api } = vi.hoisted(() => ({ api: { get: vi.fn() } }));
vi.mock('../../lib/apiClient', () => ({ apiClient: api }));

import { obtenerMetricas, obtenerConsumo } from './api';

describe('metricas/api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('obtiene metricas por rol', async () => {
    api.get.mockResolvedValue({
      data: {
        alcance: 'individual',
        pacientes: 3,
        consultas: 5,
        citas: 2,
        vacunas: 1,
        vacunasProximas: 1,
        vacunasVencidas: 2,
        cumplimientoVacunacion: 67,
        topDiagnosticos: [{ nombre: 'Otitis', total: 2 }],
        distribucionEspecies: [{ clave: 'perro', total: 3 }],
        soapUsados: 4,
        soapLimite: 10,
      },
    });
    const m = await obtenerMetricas({ desde: '2026-06-01' });
    expect(api.get).toHaveBeenCalledWith('/v1/metricas', { params: { desde: '2026-06-01' } });
    expect(m.alcance).toBe('individual');
    expect(m.pacientes).toBe(3);
    expect(m.vacunasVencidas).toBe(2);
    expect(m.cumplimientoVacunacion).toBe(67);
    expect(m.topDiagnosticos[0].nombre).toBe('Otitis');
    expect(m.distribucionEspecies?.[0].clave).toBe('perro');
    expect(m.soapUsados).toBe(4);
  });

  it('obtiene consumo actual', async () => {
    api.get.mockResolvedValue({ data: { periodo: '2026-06', usados: 4, limite: 5, restante: 1, porcentaje: 80, alcanzo80: true, bloqueado: false } });
    const c = await obtenerConsumo();
    expect(c.porcentaje).toBe(80);
    expect(c.alcanzo80).toBe(true);
  });
});
