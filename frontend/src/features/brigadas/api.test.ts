import { beforeEach, describe, expect, it, vi } from 'vitest';

const flagState = { useApiCRUD: false };

vi.mock('../../lib/featureFlags', () => ({
  getFeatureFlags: () => ({ useApiCRUD: flagState.useApiCRUD }),
}));

vi.mock('../../lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
}));
vi.mock('../../lib/firebase', () => ({ db: {} }));

import { apiClient } from '../../lib/apiClient';
import { addDoc, getDocs, updateDoc } from 'firebase/firestore';
import {
  actualizarBrigadaDoc,
  crearBrigada,
  listarAtencionesBrigada,
  listarBrigadas,
  obtenerConsolidadoBrigada,
  registrarAtencionBrigada,
} from './api';

describe('brigadas/api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagState.useApiCRUD = true;
  });

  it('listarBrigadas usa GET /v1/brigadas con flag on', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        {
          id: 'b1',
          nombre: 'API',
          fecha: '2026-01-01',
          ubicacion: { direccion: '', ciudad: 'Bogotá' },
          veterinarioIds: ['u1'],
          estado: 'planificada',
          creadoEn: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const list = await listarBrigadas('u1');
    expect(apiClient.get).toHaveBeenCalledWith('/v1/brigadas');
    expect(list[0]?.nombre).toBe('API');
  });

  it('crearBrigada usa POST /v1/brigadas sin autoagregar el uid en /v1', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        id: 'b2',
        nombre: 'Nueva',
        fecha: '2026-02-01',
        ubicacion: { direccion: '', ciudad: 'Medellín' },
        veterinarioIds: ['vet1'],
        estado: 'planificada',
        creadoEn: '2026-02-01T00:00:00.000Z',
      },
    });
    await crearBrigada('admin1', {
      nombre: 'Nueva',
      fecha: '2026-02-01',
      ubicacion: { direccion: '', ciudad: 'Medellín' },
      veterinarioIds: ['vet1'],
      estado: 'planificada',
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/v1/brigadas',
      expect.objectContaining({ nombre: 'Nueva', veterinarioIds: ['vet1'] }),
    );
    expect(vi.mocked(apiClient.post).mock.calls[0]?.[1]).not.toEqual(
      expect.objectContaining({ veterinarioIds: expect.arrayContaining(['admin1']) }),
    );
  });

  it('actualizarBrigadaDoc usa PATCH /v1/brigadas/:id con flag on', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });
    await actualizarBrigadaDoc('b1', { estado: 'en_curso' });
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/brigadas/b1', { estado: 'en_curso' });
  });

  it('listarAtencionesBrigada usa GET /v1/brigadas/:id/atenciones', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        {
          id: 'a1',
          brigadaId: 'b1',
          veterinarioId: 'vet1',
          motivo: 'Vacunacion',
          fechaHora: '2026-06-01T10:00:00.000Z',
          createdBy: 'vet1',
        },
      ],
    });
    const list = await listarAtencionesBrigada('b1');
    expect(apiClient.get).toHaveBeenCalledWith('/v1/brigadas/b1/atenciones');
    expect(list[0]?.motivo).toBe('Vacunacion');
  });

  it('registrarAtencionBrigada usa POST /v1/brigadas/:id/atenciones', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        id: 'a1',
        brigadaId: 'b1',
        veterinarioId: 'vet1',
        motivo: 'Control',
        fechaHora: '2026-06-01T10:00:00.000Z',
        createdBy: 'vet1',
      },
    });
    await registrarAtencionBrigada('b1', { motivo: 'Control', pacienteId: 'p1' });
    expect(apiClient.post).toHaveBeenCalledWith('/v1/brigadas/b1/atenciones', {
      motivo: 'Control',
      pacienteId: 'p1',
    });
  });

  it('obtenerConsolidadoBrigada usa GET /v1/brigadas/:id/consolidado', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        brigadaId: 'b1',
        nombre: 'Brigada',
        estado: 'planificada',
        fecha: '2026-06-01',
        totalAtenciones: 2,
        pacientesUnicos: 1,
        veterinariosParticipantes: 2,
        veterinariosConAtencion: 1,
      },
    });
    const res = await obtenerConsolidadoBrigada('b1');
    expect(apiClient.get).toHaveBeenCalledWith('/v1/brigadas/b1/consolidado');
    expect(res.totalAtenciones).toBe(2);
  });

  it('listarBrigadas usa Firestore legacy con flag off', async () => {
    flagState.useApiCRUD = false;
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          id: 'fs1',
          data: () => ({
            nombre: 'Legacy',
            fecha: '2026-03-01',
            ubicacion: { direccion: '', ciudad: 'Cali' },
            veterinarioIds: ['u1'],
            estado: 'planificada',
            creadoEn: new Date(),
          }),
        },
      ],
    } as never);
    const list = await listarBrigadas('u1');
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(getDocs).toHaveBeenCalled();
    expect(list[0]?.nombre).toBe('Legacy');
  });

  it('crearBrigada usa addDoc legacy con flag off', async () => {
    flagState.useApiCRUD = false;
    vi.mocked(addDoc).mockResolvedValue({ id: 'fs-new' } as never);
    const res = await crearBrigada('u1', {
      nombre: 'Legacy Create',
      fecha: '2026-04-01',
      ubicacion: { direccion: '', ciudad: 'Pereira' },
      veterinarioIds: [],
      estado: 'planificada',
    });
    expect(addDoc).toHaveBeenCalled();
    expect(vi.mocked(addDoc).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ veterinarioIds: ['u1'] }),
    );
    expect(res.id).toBe('fs-new');
  });

  it('actualizarBrigadaDoc usa updateDoc legacy con flag off', async () => {
    flagState.useApiCRUD = false;
    await actualizarBrigadaDoc('fs1', { estado: 'finalizada' });
    expect(updateDoc).toHaveBeenCalled();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
});
