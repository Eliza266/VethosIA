import { describe, expect, it } from 'vitest';
import {
  consultaDetailPath,
  consultaDocumentPath,
  findLatestApprovedConsulta,
  resolveClinicalDocumentPath,
  resolveModulePath,
} from './clinicalDocuments';
import type { Consulta } from '../types';

const consultas = [
  {
    id: 'c1',
    pacienteId: 'p1',
    veterinarioId: 'v1',
    estado: 'borrador',
    fechaHora: new Date('2026-06-01T10:00:00Z'),
    creadoEn: new Date('2026-06-01T10:00:00Z'),
  },
  {
    id: 'c2',
    pacienteId: 'p2',
    veterinarioId: 'v1',
    estado: 'aprobada',
    fechaHora: new Date('2026-06-02T10:00:00Z'),
    creadoEn: new Date('2026-06-02T10:00:00Z'),
    soap: { subjetivo: 'ok', objetivo: 'ok', analisis: 'ok', plan: 'ok' },
  },
] as Consulta[];

describe('clinicalDocuments', () => {
  it('encuentra la consulta aprobada más reciente', () => {
    expect(findLatestApprovedConsulta(consultas)?.id).toBe('c2');
  });

  it('envía a detalle cuando hay consulta aprobada', () => {
    expect(resolveClinicalDocumentPath('pdf', consultas)).toBe(
      '/pacientes/p2/consultas/c2?documento=pdf',
    );
  });

  it('envía a hub documentos sin contexto', () => {
    expect(resolveClinicalDocumentPath('whatsapp', [consultas[0]!])).toBe(
      '/documentos?accion=whatsapp',
    );
  });

  it('construye rutas de detalle y documento por consulta', () => {
    expect(consultaDetailPath(consultas[1]!)).toBe('/pacientes/p2/consultas/c2');
    expect(consultaDocumentPath(consultas[1]!, 'email')).toBe(
      '/pacientes/p2/consultas/c2?documento=email',
    );
  });

  it('resuelve consulta SOAP al borrador o aprobada más reciente', () => {
    expect(resolveModulePath('consulta-soap', '/pacientes', consultas)).toBe(
      '/pacientes/p2/consultas/c2',
    );
    expect(resolveModulePath('consulta-soap', '/pacientes', [consultas[0]!])).toBe(
      '/pacientes/p1/consultas/c1',
    );
  });
});
