import { describe, it, expect, vi, beforeEach } from 'vitest';

// Controlamos el flag y el apiClient para verificar el switch Strangler Fig.
const { flagState, api } = vi.hoisted(() => ({
  flagState: { useApiCRUD: false },
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../lib/featureFlags', () => ({
  getFeatureFlags: () => ({
    useApiIA: false,
    useApiDocs: false,
    useApiCRUD: flagState.useApiCRUD,
  }),
}));
vi.mock('../../lib/apiClient', () => ({ apiClient: api }));

// Firestore: mock para la rama legacy (no debe usarse cuando el flag esta on).
const firestoreCalls = { getDocs: vi.fn(), addDoc: vi.fn() };
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: (...a: unknown[]) => firestoreCalls.getDocs(...a),
  addDoc: (...a: unknown[]) => firestoreCalls.addDoc(...a),
  updateDoc: vi.fn(),
}));
vi.mock('../../lib/firebase', () => ({ db: {} }));

import {
  listarPacientes,
  crearPaciente,
  actualizarPacienteDoc,
  eliminarPaciente,
} from './api';

describe('features/pacientes/api (Strangler Fig)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagState.useApiCRUD = true;
  });

  it('listarPacientes usa GET /v1/pacientes cuando el flag esta on', async () => {
    api.get.mockResolvedValue({ data: [{ id: 'p1', nombre: 'Rex' }] });
    const res = await listarPacientes('u1');
    expect(api.get).toHaveBeenCalledWith('/v1/pacientes');
    expect(res).toEqual([{ id: 'p1', nombre: 'Rex' }]);
    expect(firestoreCalls.getDocs).not.toHaveBeenCalled();
  });

  it('crearPaciente usa POST /v1/pacientes', async () => {
    api.post.mockResolvedValue({ data: { id: 'p2', nombre: 'Michi' } });
    const res = await crearPaciente('u1', { nombre: 'Michi' } as never);
    expect(api.post).toHaveBeenCalledWith('/v1/pacientes', { nombre: 'Michi' });
    expect(res.id).toBe('p2');
    expect(firestoreCalls.addDoc).not.toHaveBeenCalled();
  });

  it('actualizar usa PATCH y eliminar usa DELETE', async () => {
    api.patch.mockResolvedValue({ data: {} });
    api.delete.mockResolvedValue({ data: { eliminado: true } });
    await actualizarPacienteDoc('p1', { nombre: 'Rex II' });
    await eliminarPaciente('p1');
    expect(api.patch).toHaveBeenCalledWith('/v1/pacientes/p1', { nombre: 'Rex II' });
    expect(api.delete).toHaveBeenCalledWith('/v1/pacientes/p1');
  });

  it('con el flag off NO toca la API (usa Firestore legacy)', async () => {
    flagState.useApiCRUD = false;
    firestoreCalls.getDocs.mockResolvedValue({ docs: [] });
    await listarPacientes('u1');
    expect(api.get).not.toHaveBeenCalled();
    expect(firestoreCalls.getDocs).toHaveBeenCalled();
  });
});
