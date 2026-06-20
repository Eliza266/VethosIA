import { describe, expect, it } from 'vitest';
import { stripUndefinedFields } from './firestoreData';

describe('stripUndefinedFields', () => {
  it('remueve undefined de objetos anidados antes de enviar a Firestore', () => {
    const date = new Date('2026-06-15T12:00:00.000Z');
    const input = {
      nombre: 'Luna',
      raza: undefined,
      propietario: {
        nombre: 'Propietario',
        email: undefined,
      },
      vacunas: [{ nombre: 'Rabia', lote: undefined }, undefined],
      creadoEn: date,
    };

    const result = stripUndefinedFields(input);

    expect(result).toEqual({
      nombre: 'Luna',
      propietario: { nombre: 'Propietario' },
      vacunas: [{ nombre: 'Rabia' }],
      creadoEn: date,
    });
    expect(result.creadoEn).toBe(date);
  });
});
