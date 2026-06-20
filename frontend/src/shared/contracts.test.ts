import { describe, it, expect } from 'vitest';
import {
  soapContract,
  metricasContract,
  consumoContract,
  pacienteContract,
} from './contracts';

// Contract tests: validan que las respuestas de ejemplo del API /v1 cumplen el shape
// que el frontend consume. Si el backend cambia el contrato, esto falla.
describe('contratos /v1', () => {
  it('SOAP valido pasa el contrato', () => {
    const ok = soapContract.safeParse({
      motivo: 'tos',
      prioridad: 'rutina',
      signosVitales: { peso: 28, temperatura: null },
      subjetivo: 's',
      objetivo: 'o',
      analisis: 'a',
      plan: 'p',
      medicamentosSugeridos: [],
    });
    expect(ok.success).toBe(true);
  });

  it('SOAP con prioridad invalida falla', () => {
    const bad = soapContract.safeParse({
      motivo: 'x',
      prioridad: 'loquesea',
      signosVitales: {},
      subjetivo: '',
      objetivo: '',
      analisis: '',
      plan: '',
      medicamentosSugeridos: [],
    });
    expect(bad.success).toBe(false);
  });

  it('metricas, consumo y paciente validan', () => {
    expect(metricasContract.safeParse({ alcance: 'individual', pacientes: 1, consultas: 2, citas: 0, vacunas: 3 }).success).toBe(true);
    expect(
      consumoContract.safeParse({ periodo: '2026-06', usados: 4, limite: 5, restante: 1, porcentaje: 80, alcanzo80: true, bloqueado: false }).success,
    ).toBe(true);
    expect(pacienteContract.safeParse({ id: 'p1', nombre: 'Rex', deletedAt: null }).success).toBe(true);
  });
});
