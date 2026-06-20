import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../lib/errors';

const { flagState, api } = vi.hoisted(() => ({
  flagState: { useApiDocs: true },
  api: { post: vi.fn() },
}));

vi.mock('../../lib/featureFlags', () => ({
  getFeatureFlags: () => ({
    useApiHC: true,
    useApiIA: true,
    useApiDocs: flagState.useApiDocs,
    useApiCRUD: true,
  }),
}));

vi.mock('../../lib/apiClient', () => ({ apiClient: api }));
vi.mock('../../lib/firebase', () => ({ storage: {} }));
vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(),
}));

import { enviarHistorialEmail } from './api';

describe('features/consultas/api email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagState.useApiDocs = true;
  });

  it('envia historial por /v1/consultas/:id/email cuando docs API esta activo', async () => {
    api.post.mockResolvedValue({ data: { success: true } });

    await expect(
      enviarHistorialEmail('c1', {
        emailDestinatario: 'qa@example.com',
        nombrePropietario: 'QA',
        nombrePaciente: 'Mascota QA',
        nombreVet: 'Vet QA',
      }),
    ).resolves.toBe(true);

    expect(api.post).toHaveBeenCalledWith('/v1/consultas/c1/email', {
      emailDestinatario: 'qa@example.com',
      nombrePropietario: 'QA',
      nombrePaciente: 'Mascota QA',
      nombreVet: 'Vet QA',
    });
  });

  it('preserva error controlado cuando el proveedor de email no esta configurado', async () => {
    api.post.mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
          message: 'El envio por correo no esta configurado para esta cuenta.',
        },
      },
    });

    await expect(
      enviarHistorialEmail('c1', {
        emailDestinatario: 'qa@example.com',
        nombrePropietario: 'QA',
        nombrePaciente: 'Mascota QA',
        nombreVet: 'Vet QA',
      }),
    ).rejects.toMatchObject({
      name: 'AppError',
      code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
      message: 'El envio por correo no esta configurado para esta cuenta.',
    } satisfies Partial<AppError>);
  });
});
