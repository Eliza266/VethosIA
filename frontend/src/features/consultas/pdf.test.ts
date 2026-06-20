import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildHistoriaClinicaModel, renderHistoriaClinicaPDF, type HistoriaClinicaPDFInput } from './pdf';
import type { Consulta, Paciente } from '../../types';

const input: HistoriaClinicaPDFInput = {
  consulta: {
    numeroHC: 'HC-001',
    pacienteId: 'p1',
    veterinarioId: 'v1',
    fechaHora: new Date('2024-01-15T10:30:00.000Z'),
    motivo: 'Vómito agudo',
    prioridad: 'urgente',
    signosVitales: { peso: 10, talla: 35, temperatura: 39 },
    soap: {
      subjetivo: 'Vomitó 3 veces',
      objetivo: 'Deshidratación leve',
      analisis: 'Gastroenteritis',
      plan: 'Hidratar y dieta blanda',
    },
    estado: 'aprobada',
    creadoEn: new Date('2024-01-15T10:30:00.000Z'),
  } as Consulta,
  paciente: {
    nombre: 'Firulais',
    especie: 'perro',
    raza: 'Criollo',
    sexo: 'macho',
    estadoReproductivo: 'entero',
    color: 'Marrón',
    chip: '123',
    fechaNacimiento: '2020-01-01',
    veterinarioId: 'v1',
    propietario: { nombre: 'Ana', telefono: '3001234567' },
    creadoEn: new Date(),
  } as Paciente,
  vet: {
    veterinaria: 'Clínica Patitas',
    sede: 'Norte',
    ciudad: 'Bogotá',
    telefono: '6011234',
    nombre: 'Dra. López',
    matriculaProfesional: 'MP-999',
  },
};

describe('buildHistoriaClinicaModel (golden / texto en vez de binario)', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000-05:00'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('arma el modelo completo del PDF', () => {
    expect(buildHistoriaClinicaModel(input)).toMatchSnapshot();
  });

  it('incluye talla en los vitales (bug que faltaba antes)', () => {
    const model = buildHistoriaClinicaModel(input);
    expect(model.vitales).toContainEqual({ label: 'Talla', val: '35 cm' });
  });

  it('usa fallbacks cuando faltan datos del vet/paciente', () => {
    const sinDatos = buildHistoriaClinicaModel({
      ...input,
      vet: {},
      consulta: { ...input.consulta, numeroHC: undefined, motivo: undefined, soap: undefined },
    });
    expect(sinDatos.header.vetName).toBe('Clínica Veterinaria');
    expect(sinDatos.header.numeroHC).toBe('S/N');
    expect(sinDatos.consulta.motivo).toBe('No reportado');
    expect(sinDatos.firma.nombre).toBe('Dr(a). Veterinario');
    expect(sinDatos.firma.matricula).toBeNull();
  });
});

describe('renderHistoriaClinicaPDF', () => {
  it('genera un jsPDF con al menos una pagina (smoke)', () => {
    const pdf = renderHistoriaClinicaPDF(input);
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    // el output como arraybuffer no debe estar vacio
    const out = pdf.output('arraybuffer');
    expect(out.byteLength).toBeGreaterThan(0);
  });
});
