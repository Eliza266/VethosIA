import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { AdminVetModeProvider, useAdminVetMode } from './useAdminVetMode';
import { useMe } from '../features/tenant/hooks';

// Mock useMe hook
vi.mock('../features/tenant/hooks', () => ({
  useMe: vi.fn(),
}));

const TestComponent: React.FC = () => {
  const { mode, setMode, isAdminVet } = useAdminVetMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="is-admin-vet">{isAdminVet ? 'yes' : 'no'}</span>
      <button data-testid="btn-admin" onClick={() => setMode('admin')}>Set Admin</button>
      <button data-testid="btn-vet" onClick={() => setMode('veterinario')}>Set Vet</button>
    </div>
  );
};

describe('useAdminVetMode Context and Hook', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('proporciona valores por defecto para admin_veterinaria', () => {
    // Mock user as admin_veterinaria
    (useMe as any).mockReturnValue({
      data: { role: 'admin_veterinaria', uid: 'user1' },
      isLoading: false,
    });

    render(
      <AdminVetModeProvider>
        <TestComponent />
      </AdminVetModeProvider>
    );

    expect(screen.getByTestId('mode').textContent).toBe('admin');
    expect(screen.getByTestId('is-admin-vet').textContent).toBe('yes');
  });

  it('permite cambiar el modo y lo persiste en localStorage', () => {
    (useMe as any).mockReturnValue({
      data: { role: 'admin_veterinaria', uid: 'user1' },
      isLoading: false,
    });

    render(
      <AdminVetModeProvider>
        <TestComponent />
      </AdminVetModeProvider>
    );

    expect(screen.getByTestId('mode').textContent).toBe('admin');
    expect(localStorage.getItem('vethos_admin_vet_mode')).toBeNull();

    // Toggle to veterinario
    act(() => {
      screen.getByTestId('btn-vet').click();
    });

    expect(screen.getByTestId('mode').textContent).toBe('veterinario');
    expect(localStorage.getItem('vethos_admin_vet_mode')).toBe('veterinario');

    // Toggle back to admin
    act(() => {
      screen.getByTestId('btn-admin').click();
    });

    expect(screen.getByTestId('mode').textContent).toBe('admin');
    expect(localStorage.getItem('vethos_admin_vet_mode')).toBe('admin');
  });

  it('recupera el ultimo modo guardado en localStorage', () => {
    localStorage.setItem('vethos_admin_vet_mode', 'veterinario');

    (useMe as any).mockReturnValue({
      data: { role: 'admin_veterinaria', uid: 'user1' },
      isLoading: false,
    });

    render(
      <AdminVetModeProvider>
        <TestComponent />
      </AdminVetModeProvider>
    );

    expect(screen.getByTestId('mode').textContent).toBe('veterinario');
    expect(screen.getByTestId('is-admin-vet').textContent).toBe('yes');
  });

  it('si el rol no es admin_veterinaria, isAdminVet es false y el modo es siempre admin', () => {
    localStorage.setItem('vethos_admin_vet_mode', 'veterinario');

    (useMe as any).mockReturnValue({
      data: { role: 'veterinario', uid: 'user1' },
      isLoading: false,
    });

    render(
      <AdminVetModeProvider>
        <TestComponent />
      </AdminVetModeProvider>
    );

    expect(screen.getByTestId('mode').textContent).toBe('admin');
    expect(screen.getByTestId('is-admin-vet').textContent).toBe('no');
  });
});
