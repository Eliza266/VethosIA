import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BrigadasRoute from './BrigadasRoute';

const mockUseMe = vi.fn();

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

function renderGuard(profile: Record<string, unknown> | null) {
  mockUseMe.mockReturnValue({ data: profile, isLoading: false });
  return render(
    <MemoryRouter initialEntries={['/brigadas']}>
      <Routes>
        <Route element={<BrigadasRoute />}>
          <Route path="/brigadas" element={<div>Brigadas Operativas</div>} />
        </Route>
        <Route path="/" element={<div>Dashboard</div>} />
        <Route path="/admin" element={<div>Plataforma</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BrigadasRoute', () => {
  it.each([
    ['admin_entidad', { role: 'admin_entidad', rol: 'admin' }],
    ['admin_veterinaria', { role: 'admin_veterinaria', rol: 'admin', veterinariaId: 'vetA' }],
    ['veterinario', { role: 'veterinario', rol: 'vet' }],
  ])('permite %s', (_label, profile) => {
    renderGuard(profile);
    expect(screen.getByText('Brigadas Operativas')).toBeInTheDocument();
  });

  it('bloquea superadmin hacia plataforma', () => {
    renderGuard({ role: 'superadmin', rol: 'superadmin' });
    expect(screen.getByText('Plataforma')).toBeInTheDocument();
    expect(screen.queryByText('Brigadas Operativas')).not.toBeInTheDocument();
  });

  it('bloquea asistente hacia dashboard', () => {
    renderGuard({ rol: 'asistente' });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Brigadas Operativas')).not.toBeInTheDocument();
  });
});
