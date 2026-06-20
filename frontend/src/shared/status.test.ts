import { describe, it, expect } from 'vitest';
import { estadoBadgeVariant } from './status';

describe('estadoBadgeVariant (colores del PDF)', () => {
  it('info: programada/procesando', () => {
    expect(estadoBadgeVariant('programada')).toBe('info');
    expect(estadoBadgeVariant('procesando')).toBe('info');
  });
  it('success: realizada/aprobada/al_dia/activa', () => {
    for (const e of ['realizada', 'aprobada', 'al_dia', 'activa']) {
      expect(estadoBadgeVariant(e)).toBe('success');
    }
  });
  it('warn: proxima/borrador/por_vencer', () => {
    for (const e of ['proxima', 'proxima_a_vencer', 'borrador', 'por_vencer']) {
      expect(estadoBadgeVariant(e)).toBe('warn');
    }
  });
  it('danger: cancelada/vencida/error/bloqueada_mora', () => {
    for (const e of ['cancelada', 'vencida', 'error', 'bloqueada_mora']) {
      expect(estadoBadgeVariant(e)).toBe('danger');
    }
  });
  it('neutral: no_asistio/desconocido', () => {
    expect(estadoBadgeVariant('no_asistio')).toBe('neutral');
    expect(estadoBadgeVariant(undefined)).toBe('neutral');
  });
});
