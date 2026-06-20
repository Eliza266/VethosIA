import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de lib/firebase para controlar auth.currentUser sin inicializar Firebase real.
const { authState } = vi.hoisted(() => ({
  authState: { currentUser: null as null | { getIdToken: () => Promise<string> } },
}));
vi.mock('./firebase', () => ({ auth: authState }));

import { apiClient } from './apiClient';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// adapter que NO pega a la red: captura el config (con headers ya interceptados)
const makeAdapter = () =>
  vi.fn(
    async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })
  );

describe('apiClient (inyeccion de token)', () => {
  beforeEach(() => {
    authState.currentUser = null;
  });

  it('inyecta el Bearer token cuando hay usuario', async () => {
    authState.currentUser = { getIdToken: vi.fn().mockResolvedValue('fake-id-token') };
    const adapter = makeAdapter();
    await apiClient.get('/v1/health', { adapter });
    const sentConfig = adapter.mock.calls[0][0];
    expect(sentConfig.headers.get('Authorization')).toBe('Bearer fake-id-token');
  });

  it('no manda Authorization si no hay usuario logueado', async () => {
    const adapter = makeAdapter();
    await apiClient.get('/v1/health', { adapter });
    const sentConfig = adapter.mock.calls[0][0];
    expect(sentConfig.headers.get('Authorization')).toBeFalsy();
  });

  it('usa la baseURL configurada', () => {
    expect(apiClient.defaults.baseURL).toBeDefined();
  });

  it('fuerza refresh del token cuando requestFreshIdToken fue marcado', async () => {
    const getIdToken = vi.fn().mockResolvedValue('forced-token');
    authState.currentUser = { getIdToken };
    const { requestFreshIdToken } = await import('./apiClient');
    requestFreshIdToken();
    const adapter = makeAdapter();
    await apiClient.get('/v1/health', { adapter });
    expect(getIdToken).toHaveBeenCalledWith(true);
  });
});
