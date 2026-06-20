import { describe, it, expect } from 'vitest';
import {
  parseGeminiJSON,
  normalizeResultadoSOAP,
  buildFallbackResultado,
} from './soapNormalize';

describe('soapNormalize', () => {
  it('parseGeminiJSON tolera texto/backticks alrededor', () => {
    expect(parseGeminiJSON('texto ```json\n{"a":1}\n``` fin')).toEqual({ a: 1 });
    expect(parseGeminiJSON('no json')).toBeNull();
    expect(parseGeminiJSON('')).toBeNull();
  });

  it('normaliza prioridad invalida a rutina y numeros', () => {
    const r = normalizeResultadoSOAP(
      { motivo: 'tos', prioridad: 'xxx', signosVitales: { peso: 12, altura: 30 } },
      true,
    );
    expect(r.prioridad).toBe('rutina');
    expect(r.signosVitales.peso).toBe(12);
    expect(r.signosVitales.talla).toBe(30);
    expect(r.generadoPorIA).toBe(true);
  });

  it('descarta numeros invalidos en signos vitales', () => {
    const r = normalizeResultadoSOAP({ signosVitales: { peso: 'abc' } }, true);
    expect(r.signosVitales.peso).toBeUndefined();
  });

  it('buildFallbackResultado marca generadoPorIA=false y mete transcripcion', () => {
    const r = buildFallbackResultado('cruda');
    expect(r.generadoPorIA).toBe(false);
    expect(r.subjetivo).toBe('cruda');
  });
});
