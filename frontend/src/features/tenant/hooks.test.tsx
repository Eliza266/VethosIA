import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  firebaseUser: null as null | { uid: string },
  meByUid: {
    admin: {
      uid: 'admin-uid',
      email: 'admin@test.com',
      orgId: 'orgA',
      rol: 'admin' as const,
      nombre: 'Admin Entidad',
      foto: null,
      telefono: null,
      whatsapp: null,
      ciudad: null,
      sede: null,
      veterinaria: null,
      matriculaProfesional: null,
      organizacionNombre: null,
    },
    vet: {
      uid: 'vet-uid',
      email: 'vet@test.com',
      orgId: 'orgA',
      rol: 'vet' as const,
      nombre: 'Veterinario',
      foto: null,
      telefono: null,
      whatsapp: null,
      ciudad: null,
      sede: null,
      veterinaria: null,
      matriculaProfesional: null,
      organizacionNombre: null,
    },
  },
}));

vi.mock('../auth/hooks', () => ({
  useAuth: () => ({ firebaseUser: h.firebaseUser }),
}));

vi.mock('./api', () => ({
  obtenerMe: vi.fn(async () => {
    const uid = h.firebaseUser?.uid;
    if (uid === 'admin-uid') return h.meByUid.admin;
    if (uid === 'vet-uid') return h.meByUid.vet;
    throw new Error('sin uid');
  }),
}));

import { useMe } from './hooks';
import { meQueryKey } from './queryKeys';
import { obtenerMe } from './api';

const createWrapper = (qc: QueryClient) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };

describe('useMe', () => {
  beforeEach(() => {
    h.firebaseUser = null;
    vi.mocked(obtenerMe).mockClear();
  });

  it('usa queryKey con uid y refetch al cambiar de usuario', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    h.firebaseUser = { uid: 'admin-uid' };

    const { result, rerender } = renderHook(() => useMe(), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.data?.rol).toBe('admin'));
    expect(obtenerMe).toHaveBeenCalledTimes(1);
    expect(qc.getQueryData<{ rol: string }>(meQueryKey('admin-uid'))?.rol).toBe('admin');

    h.firebaseUser = { uid: 'vet-uid' };
    rerender();

    await waitFor(() => expect(result.current.data?.rol).toBe('vet'));
    expect(obtenerMe).toHaveBeenCalledTimes(2);
    expect(qc.getQueryData<{ rol: string }>(meQueryKey('vet-uid'))?.rol).toBe('vet');
  });

  it('no reutiliza cache de otro uid tras logout/login simulado', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    h.firebaseUser = { uid: 'admin-uid' };

    const { result, rerender } = renderHook(() => useMe(), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.data?.rol).toBe('admin'));

    await act(async () => {
      qc.removeQueries({ queryKey: ['me'] });
      h.firebaseUser = null;
    });
    rerender();

    h.firebaseUser = { uid: 'vet-uid' };
    rerender();

    await waitFor(() => expect(result.current.data?.rol).toBe('vet'));
    expect(result.current.data?.nombre).toBe('Veterinario');
  });
});
