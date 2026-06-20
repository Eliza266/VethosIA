import { describe, expect, it } from 'vitest';
import { etiquetaIntervalo, vacunasCatalogoPorEspecie } from './catalogo';

describe('catalogo base de vacunas', () => {
  it('filtra vacunas base por especie', () => {
    expect(vacunasCatalogoPorEspecie('perro').map((v) => v.nombre)).toEqual(
      expect.arrayContaining(['Rabia', 'Polivalente canina']),
    );
    expect(vacunasCatalogoPorEspecie('gato').map((v) => v.nombre)).toEqual(
      expect.arrayContaining(['Rabia', 'Triple felina']),
    );
  });

  it('no propone catalogo universal para especie otro', () => {
    expect(vacunasCatalogoPorEspecie('otro')).toEqual([]);
  });

  it('muestra intervalo sugerido sin crear jobs ni recordatorios', () => {
    expect(etiquetaIntervalo(365)).toBe('Cada 12 meses');
    expect(etiquetaIntervalo(undefined)).toBe('Según criterio médico');
  });
});
