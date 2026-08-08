import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SubscriptionRoute from './SubscriptionRoute';

const mockUseMe = vi.fn();

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

function renderGuard(profile: Record<string, unknown> | null, loading = false) {
  mockUseMe.mockReturnValue({
    data: profile,
    isLoading: loading,
  });

  return render(
    <MemoryRouter initialEntries={['/suscripcion']}>
      <Routes>
        <Route element={<SubscriptionRoute />}>
          <Route path="/suscripcion" element={<div>Gestion de suscripcion</div>} />
        </Route>
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SubscriptionRoute', () => {
  it('permite a veterinario vinculado legacy ver /suscripcion en modo lectura', () => {
    renderGuard({ uid: 'vet1', rol: 'vet', orgId: 'iVQURlMlESO5af6hbQ8I' });

    expect(screen.getByText('Gestion de suscripcion')).toBeInTheDocument();
  });

  it('permite admins de entidad y veterinaria', () => {
    const adminEntidad = renderGuard({ uid: 'admin1', rol: 'admin_entidad', orgId: 'ent_1' });
    expect(screen.getByText('Gestion de suscripcion')).toBeInTheDocument();
    adminEntidad.unmount();

    renderGuard({ uid: 'adminVet1', rol: 'admin_veterinaria', veterinariaId: 'vetclin_1' });
    expect(screen.getByText('Gestion de suscripcion')).toBeInTheDocument();
  });

  it('no abre ruta tenant de suscripcion para superadmin ni asistente legacy', () => {
    const superadmin = renderGuard({ uid: 'super1', rol: 'superadmin' });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    superadmin.unmount();

    renderGuard({ uid: 'asistente1', rol: 'asistente', orgId: 'org_1' });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('permite veterinario independiente gestionar su plan propio', () => {
    renderGuard({ uid: 'vet-ind', rol: 'vet', orgId: null, accountType: 'vet_individual' });

    expect(screen.getByText('Gestion de suscripcion')).toBeInTheDocument();
  });
});
