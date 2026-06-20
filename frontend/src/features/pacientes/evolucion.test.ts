import { describe, expect, it } from 'vitest';
import type { Consulta } from '../../types';
import { construirEvolucionClinica } from './evolucion';

const consulta = (id: string, fechaHora: string, signosVitales?: Consulta['signosVitales']): Consulta => ({
  id,
  pacienteId: 'p1',
  veterinarioId: 'v1',
  fechaHora: new Date(fechaHora),
  signosVitales,
  estado: 'aprobada',
  creadoEn: new Date(fechaHora),
});

describe('construirEvolucionClinica', () => {
  it('usa solo constantes reales y toma el ultimo registro clinico', () => {
    const evolucion = construirEvolucionClinica([
      consulta('c1', '2026-06-01T10:00:00Z', { peso: 10 }),
      consulta('c2', '2026-06-10T10:00:00Z'),
      consulta('c3', '2026-06-15T10:00:00Z', {
        peso: 11.4,
        talla: 42,
        temperatura: 38.7,
        frecuenciaCardiaca: 92,
        frecuenciaRespiratoria: 24,
        pulso: 'fuerte',
      }),
    ]);

    expect(evolucion.puntos).toHaveLength(2);
    expect(evolucion.ultimo).toMatchObject({
      consultaId: 'c3',
      peso: 11.4,
      talla: 42,
      temperatura: 38.7,
      frecuenciaCardiaca: 92,
      frecuenciaRespiratoria: 24,
      pulso: 'fuerte',
    });
  });

  it('calcula tendencia simple de peso sin inventar datos faltantes', () => {
    const evolucion = construirEvolucionClinica([
      consulta('c1', '2026-06-01T10:00:00Z', { temperatura: 39.1 }),
      consulta('c2', '2026-06-10T10:00:00Z', { peso: 12 }),
      consulta('c3', '2026-06-15T10:00:00Z', { peso: 11.2 }),
    ]);

    expect(evolucion.tendenciaPeso).toEqual({ estado: 'baja', deltaKg: -0.8 });
  });

  it('devuelve estado vacio profesional cuando no hay constantes', () => {
    expect(construirEvolucionClinica([consulta('c1', '2026-06-01T10:00:00Z')])).toEqual({
      puntos: [],
      ultimo: null,
      tendenciaPeso: null,
    });
  });
});
