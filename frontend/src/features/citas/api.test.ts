import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../lib/apiClient';
import {
  etiquetaPacienteCita,
  listarCitasProximas2h,
  motivoCita,
  sugerirPacientePorTitulo,
  type Cita,
} from './api';

vi.mock('../../lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const base: Cita = {
  id: 'c1',
  titulo: 'firulais',
  fecha: '2026-07-01T10:00:00Z',
  estado: 'programada',
};

describe('citas api helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista citas proximas a 2h desde API', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [base] });
    await expect(listarCitasProximas2h()).resolves.toEqual([base]);
    expect(apiClient.get).toHaveBeenCalledWith('/v1/citas/proximas-2h');
  });

  it('etiquetaPacienteCita prioriza pacienteNombre', () => {
    expect(etiquetaPacienteCita({ ...base, pacienteNombre: 'Firulais' })).toBe('Firulais');
  });

  it('etiquetaPacienteCita marca legacy sin paciente', () => {
    expect(etiquetaPacienteCita(base)).toBe('Paciente no vinculado');
  });

  it('motivoCita usa motivo o titulo legacy', () => {
    expect(motivoCita({ ...base, motivo: 'Control' })).toBe('Control');
    expect(motivoCita(base)).toBe('firulais');
  });

  it('sugerirPacientePorTitulo match exacto case-insensitive', () => {
    const pacientes = [{ id: 'p1', nombre: 'Firulais' }];
    expect(sugerirPacientePorTitulo('firulais', pacientes)?.id).toBe('p1');
    expect(sugerirPacientePorTitulo('Otro', pacientes)).toBeUndefined();
  });
});
