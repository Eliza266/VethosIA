import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Estado compartido controlable por cada test (hoisted para usarse en los vi.mock)
const h = vi.hoisted(() => ({
  authCallback: null as null | ((u: unknown) => Promise<void> | void),
  signOutMock: vi.fn().mockResolvedValue(undefined),
  signInMock: vi.fn().mockResolvedValue(undefined),
  configAcceso: { exists: true, emails: [] as string[], throws: false },
  vetExists: true,
  useApiCRUD: false,
  meProfile: {
    uid: 'u1',
    email: 'a@b.com',
    orgId: 'orgA',
    rol: 'vet' as const,
    nombre: 'Vet API',
    foto: null,
    telefono: null,
    whatsapp: null,
    ciudad: null,
    sede: null,
    veterinaria: null,
    matriculaProfesional: null,
    organizacionNombre: null,
  },
}));

vi.mock('../../lib/featureFlags', () => ({
  getFeatureFlags: () => ({ useApiCRUD: h.useApiCRUD }),
}));

vi.mock('../tenant/api', () => ({
  obtenerMe: vi.fn(async () => h.meProfile),
}));

vi.mock('../../lib/firebase', () => ({ auth: {}, db: {}, googleProvider: {} }));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_a: unknown, cb: (u: unknown) => void) => {
    h.authCallback = cb;
    return () => {};
  },
  signInWithPopup: (...args: unknown[]) => h.signInMock(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => h.signInMock(...args),
  signOut: (...args: unknown[]) => h.signOutMock(...args),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` }),
  getDoc: vi.fn(async (ref: { path: string }) => {
    if (ref.path === 'configuracion/acceso') {
      if (h.configAcceso.throws) throw new Error('firestore down');
      return {
        exists: () => h.configAcceso.exists,
        data: () => ({ emailsPermitidos: h.configAcceso.emails }),
      };
    }
    // veterinarios/{uid}
    return {
      exists: () => h.vetExists,
      id: 'u1',
      data: () => ({ uid: 'u1', nombre: 'Vet', email: 'a@b.com', creadoEn: new Date() }),
    };
  }),
  setDoc: vi.fn().mockResolvedValue(undefined),
}));

import { AuthProvider, useAuth } from './hooks';
import { getDoc, setDoc } from 'firebase/firestore';
import { obtenerMe } from '../tenant/api';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const fakeUser = {
  uid: 'u1',
  email: 'a@b.com',
  displayName: 'Vet',
  photoURL: null,
  getIdToken: vi.fn().mockResolvedValue('fresh-token'),
};

const makeWrapper = (qc: QueryClient) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  };

describe('useAuth - verificacion de acceso (whitelist)', () => {
  beforeEach(() => {
    h.signOutMock.mockClear();
    h.configAcceso = { exists: true, emails: [], throws: false };
    h.vetExists = true;
    h.useApiCRUD = false;
    vi.mocked(getDoc).mockClear();
    vi.mocked(setDoc).mockClear();
    vi.mocked(obtenerMe).mockClear();
  });

  it('PERMITE si el email esta en la whitelist', async () => {
    h.configAcceso = { exists: true, emails: ['a@b.com'], throws: false };
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(new QueryClient()) });
    await act(async () => {
      await h.authCallback?.(fakeUser);
    });
    expect(result.current.user?.email).toBe('a@b.com');
    expect(result.current.accessDeniedMessage).toBeNull();
    expect(h.signOutMock).not.toHaveBeenCalled();
  });

  it('PERMITE si la whitelist esta vacia (sin configurar)', async () => {
    h.configAcceso = { exists: true, emails: [], throws: false };
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(new QueryClient()) });
    await act(async () => {
      await h.authCallback?.(fakeUser);
    });
    expect(result.current.user).not.toBeNull();
  });

  it('DENIEGA si el email NO esta en la whitelist (fail-closed por exclusion)', async () => {
    h.configAcceso = { exists: true, emails: ['otro@b.com'], throws: false };
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(new QueryClient()) });
    await act(async () => {
      await h.authCallback?.(fakeUser);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.accessDeniedMessage).toMatch(/no tiene acceso/i);
    expect(h.signOutMock).toHaveBeenCalled();
  });

  it('FAIL-CLOSED: si no se puede leer la whitelist, DENIEGA', async () => {
    h.configAcceso = { exists: true, emails: [], throws: true };
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(new QueryClient()) });
    await act(async () => {
      await h.authCallback?.(fakeUser);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.accessDeniedMessage).toMatch(/no pudimos verificar/i);
    expect(h.signOutMock).toHaveBeenCalled();
  });

  it('con useApiCRUD=true carga perfil vía /v1/me sin setDoc', async () => {
    h.useApiCRUD = true;
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(new QueryClient()) });
    await act(async () => {
      await h.authCallback?.(fakeUser);
    });
    expect(obtenerMe).toHaveBeenCalled();
    expect(result.current.user?.nombre).toBe('Vet API');
    expect(setDoc).not.toHaveBeenCalled();
    const accesoCalls = vi.mocked(getDoc).mock.calls.filter(
      ([ref]) => (ref as { path: string }).path === 'configuracion/acceso',
    );
    expect(accesoCalls).toHaveLength(0);
  });

  it('con useApiCRUD=true deniega acceso si /v1/me responde 403', async () => {
    h.useApiCRUD = true;
    vi.mocked(obtenerMe).mockRejectedValueOnce(
      new AxiosError(
        'Forbidden',
        '403',
        {} as InternalAxiosRequestConfig,
        undefined,
        {
          status: 403,
          data: { message: 'Tu cuenta no tiene acceso a Vethos AI.' },
          headers: {},
          statusText: 'Forbidden',
          config: {} as InternalAxiosRequestConfig,
        },
      ),
    );
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(new QueryClient()) });
    await act(async () => {
      await h.authCallback?.(fakeUser);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.accessDeniedMessage).toMatch(/no tiene acceso/i);
    expect(h.signOutMock).toHaveBeenCalled();
  });

  it('con useApiCRUD=true fail-closed si /v1/me responde 503', async () => {
    h.useApiCRUD = true;
    vi.mocked(obtenerMe).mockRejectedValueOnce(
      new AxiosError(
        'Service Unavailable',
        '503',
        {} as InternalAxiosRequestConfig,
        undefined,
        {
          status: 503,
          data: { message: 'No pudimos verificar tu acceso' },
          headers: {},
          statusText: 'Service Unavailable',
          config: {} as InternalAxiosRequestConfig,
        },
      ),
    );
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(new QueryClient()) });
    await act(async () => {
      await h.authCallback?.(fakeUser);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.accessDeniedMessage).toMatch(/no pudimos verificar/i);
    expect(h.signOutMock).toHaveBeenCalled();
  });

  it('con useApiCRUD=false usa Firestore veterinarios/{uid}', async () => {
    h.useApiCRUD = false;
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(new QueryClient()) });
    await act(async () => {
      await h.authCallback?.(fakeUser);
    });
    expect(obtenerMe).not.toHaveBeenCalled();
    expect(getDoc).toHaveBeenCalled();
    expect(result.current.user?.nombre).toBe('Vet');
  });

  it('logout limpia cache de /v1/me', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useAuth(), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await h.authCallback?.(fakeUser);
    });
    await act(async () => {
      qc.setQueryData(['me', 'u1'], h.meProfile);
    });
    expect(qc.getQueryCache().findAll({ queryKey: ['me'] })).toHaveLength(1);

    await act(async () => {
      await result.current.logout();
    });

    expect(h.signOutMock).toHaveBeenCalled();
    expect(qc.getQueryCache().findAll({ queryKey: ['me'] })).toHaveLength(0);
  });
});
