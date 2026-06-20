import { describe, expect, it } from 'vitest';
import {
  descripcionDiagnostico,
  normalizarDiagnosticosEstructurados,
} from './diagnosticos';

describe('diagnosticos estructurados', () => {
  it('normaliza arrays y descarta campos desconocidos', () => {
    expect(
      normalizarDiagnosticosEstructurados([
        {
          id: 'd1',
          nombre: 'Otitis externa',
          tipo: 'principal',
          estado: 'confirmado',
          sistema: 'auditivo',
          origen: 'ia',
          creadoEn: '2026-06-18T00:00:00.000Z',
          extra: 'no pasa',
        },
      ]),
    ).toEqual([
      {
        id: 'd1',
        nombre: 'Otitis externa',
        tipo: 'principal',
        estado: 'confirmado',
        sistema: 'auditivo',
        origen: 'ia',
        creadoEn: '2026-06-18T00:00:00.000Z',
      },
    ]);
  });

  it('mantiene compatibilidad con analisis textual cuando no hay estructura', () => {
    expect(descripcionDiagnostico(undefined, 'Dermatitis alergica probable')).toBe(
      'Dermatitis alergica probable',
    );
  });
});
