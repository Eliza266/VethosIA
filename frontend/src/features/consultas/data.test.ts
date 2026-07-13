import { describe, it, expect, vi, beforeEach } from 'vitest';

const { flagState, api, firestoreCalls } = vi.hoisted(() => ({
  flagState: { useApiCRUD: false },
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  firestoreCalls: { updateDoc: vi.fn(), deleteDoc: vi.fn() },
}));
vi.mock('../../lib/featureFlags', () => ({
  getFeatureFlags: () => ({
    useApiIA: false,
    useApiDocs: false,
    useApiCRUD: flagState.useApiCRUD,
  }),
}));
vi.mock('../../lib/apiClient', () => ({ apiClient: api }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: (...a: unknown[]) => firestoreCalls.updateDoc(...a),
  deleteDoc: (...a: unknown[]) => firestoreCalls.deleteDoc(...a),
}));
vi.mock('../../lib/firebase', () => ({ db: {} }));

import { actualizarConsultaDoc, aprobarConsultaDoc, eliminarConsultaDoc } from './data';

describe('features/consultas/data actualizarConsultaDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagState.useApiCRUD = true;
  });

  it('usa PATCH /v1/consultas/:id cuando useApiCRUD esta on', async () => {
    api.patch.mockResolvedValue({ data: {} });
    await actualizarConsultaDoc('c1', { estado: 'procesando', motivo: 'tos' });
    expect(api.patch).toHaveBeenCalledWith('/v1/consultas/c1', {
      estado: 'procesando',
      motivo: 'tos',
    });
    expect(firestoreCalls.updateDoc).not.toHaveBeenCalled();
  });

  it('con flag off usa Firestore legacy', async () => {
    flagState.useApiCRUD = false;
    firestoreCalls.updateDoc.mockResolvedValue(undefined);
    await actualizarConsultaDoc('c1', { transcripcion: 'texto' });
    expect(api.patch).not.toHaveBeenCalled();
    expect(firestoreCalls.updateDoc).toHaveBeenCalled();
  });
});

describe('features/consultas/data aprobarConsultaDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagState.useApiCRUD = true;
  });

  it('usa POST /v1/consultas/:id/aprobar cuando useApiCRUD esta on', async () => {
    api.post.mockResolvedValue({ data: { estado: 'aprobada' } });
    const res = await aprobarConsultaDoc('c1');
    expect(api.post).toHaveBeenCalledWith('/v1/consultas/c1/aprobar');
    expect(api.patch).not.toHaveBeenCalled();
    expect(res.estado).toBe('aprobada');
  });

  it('legacy usa Firestore updateDoc sin POST /aprobar', async () => {
    flagState.useApiCRUD = false;
    const { getDoc } = await import('firebase/firestore');
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ pacienteId: 'p1', signosVitales: {} }),
    } as never);
    firestoreCalls.updateDoc.mockResolvedValue(undefined);
    await aprobarConsultaDoc('c1');
    expect(api.post).not.toHaveBeenCalled();
    expect(firestoreCalls.updateDoc).toHaveBeenCalled();
  });
});

describe('features/consultas/data eliminarConsultaDoc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagState.useApiCRUD = true;
  });

  it('usa DELETE /v1/consultas/:id cuando useApiCRUD esta on', async () => {
    api.delete.mockResolvedValue({ data: { eliminado: true } });
    await eliminarConsultaDoc('c1');
    expect(api.delete).toHaveBeenCalledWith('/v1/consultas/c1');
    expect(firestoreCalls.deleteDoc).not.toHaveBeenCalled();
  });

  it('con flag off usa Firestore deleteDoc legacy', async () => {
    flagState.useApiCRUD = false;
    firestoreCalls.deleteDoc.mockResolvedValue(undefined);
    await eliminarConsultaDoc('c1');
    expect(api.delete).not.toHaveBeenCalled();
    expect(firestoreCalls.deleteDoc).toHaveBeenCalled();
  });
});
