import {
  COLLECTIONS,
  contadorHcDocId,
  consumoDocId,
  periodoActual,
} from '../../src/common/firebase/collections';

describe('collections', () => {
  it('incluye las colecciones nuevas del MVP', () => {
    for (const c of [
      'planes',
      'suscripciones',
      'consumos',
      'pagos',
      'vacunas',
      'notificaciones',
      'auditoria',
      'enmiendas',
    ]) {
      expect(Object.values(COLLECTIONS)).toContain(c);
    }
  });

  it('contadorHcDocId particiona por clinica', () => {
    expect(contadorHcDocId('orgA')).toBe('contadorHC_orgA');
  });

  it('periodoActual formatea YYYY-MM en UTC', () => {
    expect(periodoActual(new Date('2026-03-09T12:00:00Z'))).toBe('2026-03');
    expect(periodoActual(new Date('2026-12-31T23:00:00Z'))).toBe('2026-12');
  });

  it('consumoDocId combina scope y periodo', () => {
    expect(consumoDocId('vet_u1', '2026-03')).toBe('vet_u1_2026-03');
  });
});
