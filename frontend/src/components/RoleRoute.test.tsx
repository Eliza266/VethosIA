import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RoleRoute from './RoleRoute';
import type { Rol } from '../lib/rbac';

const mockUseMe = vi.fn();

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

function renderGuard({
  rol,
  role,
  path = '/entidad',
  min = 'admin_entidad',
  label = 'Panel Entidad',
  loading = false,
}: {
  rol: Rol | null;
  role?: Rol | null;
  path?: string;
  min?: Rol;
  label?: string;
  loading?: boolean;
}) {
  mockUseMe.mockReturnValue({
    data: rol || role ? { rol, role } : null,
    isLoading: loading,
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RoleRoute min={min} />}>
          <Route path={path} element={<div>{label}</div>} />
        </Route>
        <Route path="/" element={<div>Inicio</div>} />
        <Route path="/admin" element={<div>Soporte Plataforma</div>} />
        <Route path="/entidad" element={<div>Vista Entidad</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleRoute /entidad', () => {
  it('redirige vet a inicio', () => {
    renderGuard({ rol: 'vet' });
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.queryByText('Panel Entidad')).not.toBeInTheDocument();
  });

  it('redirige asistente a inicio', () => {
    renderGuard({ rol: 'asistente' });
    expect(screen.getByText('Inicio')).toBeInTheDocument();
  });

  it('muestra spinner mientras carga permisos', () => {
    renderGuard({ rol: 'admin_entidad', loading: true });
    expect(screen.getByText('Cargando permisos...')).toBeInTheDocument();
    expect(screen.queryByText('Panel Entidad')).not.toBeInTheDocument();
  });

  it('permite admin legacy como admin_entidad', () => {
    renderGuard({ rol: 'admin' });
    expect(screen.getByText('Panel Entidad')).toBeInTheDocument();
  });

  it('permite admin_entidad', () => {
    renderGuard({ rol: 'admin_entidad' });
    expect(screen.getByText('Panel Entidad')).toBeInTheDocument();
  });

  it('redirige admin_veterinaria fuera de entidad', () => {
    renderGuard({ rol: 'admin_veterinaria' });
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.queryByText('Panel Entidad')).not.toBeInTheDocument();
  });

  it('redirige superadmin fuera de rutas tenant normales', () => {
    renderGuard({ rol: 'superadmin' });
    expect(screen.getByText('Soporte Plataforma')).toBeInTheDocument();
    expect(screen.queryByText('Panel Entidad')).not.toBeInTheDocument();
  });

  it('role V2 admin_veterinaria con rol legacy admin no entra a Vista Entidad', () => {
    renderGuard({ rol: 'admin', role: 'admin_veterinaria' });
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.queryByText('Panel Entidad')).not.toBeInTheDocument();
  });

  it('permite superadmin en soporte/plataforma', () => {
    renderGuard({
      rol: 'superadmin',
      path: '/admin',
      min: 'superadmin',
      label: 'Soporte Plataforma',
    });
    expect(screen.getByText('Soporte Plataforma')).toBeInTheDocument();
  });

  it('separa acceso a veterinaria para admin_entidad/admin_veterinaria sin abrirlo a vet legacy', () => {
    const adminVeterinaria = renderGuard({
      rol: 'admin_veterinaria',
      path: '/veterinaria',
      min: 'admin_veterinaria',
      label: 'Panel Veterinaria',
    });
    expect(screen.getByText('Panel Veterinaria')).toBeInTheDocument();
    adminVeterinaria.unmount();

    const adminEntidad = renderGuard({
      rol: 'admin_entidad',
      path: '/veterinaria',
      min: 'admin_veterinaria',
      label: 'Panel Veterinaria',
    });
    expect(screen.getByText('Vista Entidad')).toBeInTheDocument();
    expect(screen.queryByText('Panel Veterinaria')).not.toBeInTheDocument();
    adminEntidad.unmount();

    renderGuard({
      rol: 'vet',
      path: '/veterinaria',
      min: 'admin_veterinaria',
      label: 'Panel Veterinaria Vet',
    });
    expect(screen.getByText('Inicio')).toBeInTheDocument();
    expect(screen.queryByText('Panel Veterinaria Vet')).not.toBeInTheDocument();
  });
});
