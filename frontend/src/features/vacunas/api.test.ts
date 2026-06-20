import { describe, it, expect, vi, beforeEach } from 'vitest';

const { api } = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../lib/apiClient', () => ({ apiClient: api }));

import {
  listarVacunasPaciente,
  listarVacunas,
  obtenerCatalogoVacunas,
  crearVacuna,
  actualizarVacuna,
  marcarVacunaAplicada,
  eliminarVacuna,
  resumenVacunasPendientes,
  vacunasPendientes,
  etiquetaEstadoVacuna,
  fechaVacuna,
  toDateInput,
} from './api';

describe('features/vacunas/api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listarVacunasPaciente usa ruta anidada bajo paciente', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'v1', pacienteId: 'p1', nombre: 'Rabia' }] });
    const res = await listarVacunasPaciente('p1');
    expect(api.get).toHaveBeenCalledWith('/v1/pacientes/p1/vacunas');
    expect(res).toHaveLength(1);
  });

  it('listarVacunas usa filtros globales', async () => {
    api.get.mockResolvedValue({ data: [] });
    await listarVacunas({ estado: 'vencida', especie: 'perro', pacienteId: 'p1', tipo: 'Rabia' });
    expect(api.get).toHaveBeenCalledWith('/v1/vacunas', {
      params: { estado: 'vencida', especie: 'perro', pacienteId: 'p1', tipo: 'Rabia' },
    });
  });

  it('obtiene catalogo base', async () => {
    api.get.mockResolvedValue({ data: [{ codigo: 'perro-rabia', nombre: 'Rabia' }] });
    expect(await obtenerCatalogoVacunas()).toHaveLength(1);
    expect(api.get).toHaveBeenCalledWith('/v1/vacunas/catalogo');
  });

  it('crearVacuna hace POST anidado sin pacienteId en body', async () => {
    api.post.mockResolvedValue({ data: { id: 'v2', pacienteId: 'p1', nombre: 'Parvo' } });
    await crearVacuna({
      pacienteId: 'p1',
      nombre: 'Parvo',
      catalogoCodigo: 'perro-polivalente',
      aplicada: '2026-06-18',
    });
    expect(api.post).toHaveBeenCalledWith('/v1/pacientes/p1/vacunas', {
      nombre: 'Parvo',
      catalogoCodigo: 'perro-polivalente',
      aplicada: '2026-06-18',
    });
  });

  it('actualizar, aplicar y eliminar usan rutas anidadas', async () => {
    api.patch.mockResolvedValue({ data: { id: 'v1', nombre: 'Rabia anual' } });
    api.post.mockResolvedValue({ data: { id: 'v1', aplicada: '2026-06-18' } });
    api.delete.mockResolvedValue({ data: { eliminado: true } });
    await actualizarVacuna('p1', 'v1', { nombre: 'Rabia anual' });
    await marcarVacunaAplicada('p1', 'v1', { aplicada: '2026-06-18' });
    await eliminarVacuna('p1', 'v1');
    expect(api.patch).toHaveBeenCalledWith('/v1/pacientes/p1/vacunas/v1', { nombre: 'Rabia anual' });
    expect(api.post).toHaveBeenCalledWith('/v1/pacientes/p1/vacunas/v1/aplicar', { aplicada: '2026-06-18' });
    expect(api.delete).toHaveBeenCalledWith('/v1/pacientes/p1/vacunas/v1');
  });

  it('pendientes devuelve resumen y mantiene alias numerico', async () => {
    api.get.mockResolvedValue({ data: { proximas: 2, vencidas: 1 } });
    expect(await resumenVacunasPendientes()).toEqual({ proximas: 2, vencidas: 1 });
    expect(await vacunasPendientes()).toBe(2);
    expect(api.get).toHaveBeenCalledWith('/v1/vacunas/pendientes');
  });

  it('helpers de presentacion', () => {
    expect(etiquetaEstadoVacuna('proxima_a_vencer')).toBe('Próxima');
    expect(etiquetaEstadoVacuna('vencida')).toBe('Vencida');
    expect(fechaVacuna({ id: 'v1', pacienteId: 'p1', nombre: 'X', aplicada: '2026-01-01' })).toBe(
      '2026-01-01',
    );
    expect(toDateInput('2026-06-15T10:00:00Z')).toBe('2026-06-15');
  });
});
