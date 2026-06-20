import { describe, expect, it } from 'vitest';
import { formatClinicalDateTime, formatClinicalName, formatConsultaEstado } from './clinicalLabels';

describe('clinicalLabels', () => {
  it('humaniza nombres QA', () => {
    expect(formatClinicalName('qa-paciente-luna')).toBe('Paciente Luna');
    expect(formatClinicalName('a1b2c3d4e5f67890')).toBe('Paciente registrado');
  });

  it('formatea estado y fecha', () => {
    expect(formatConsultaEstado('aprobada')).toBe('SOAP aprobado');
    expect(formatClinicalDateTime('2026-06-02T15:30:00Z')).toMatch(/2026/);
  });
});
