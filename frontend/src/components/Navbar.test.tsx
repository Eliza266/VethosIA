import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Navbar from './Navbar';

const mockUseAuth = vi.fn();
const mockUseMe = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

function renderNavbar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const meAdmin = {
  uid: 'u1',
  email: 'gerencia@vethosia.com',
  nombre: 'Veterinario',
  rol: 'admin' as const,
  orgId: 'org-new',
  organizacionNombre: 'Vethosia Operaciones',
  foto: null,
  telefono: null,
  whatsapp: null,
  ciudad: null,
  sede: null,
  veterinaria: null,
  matriculaProfesional: null,
};

describe('Navbar (roles y entidad)', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      firebaseUser: { uid: 'u1' },
      logout: vi.fn(),
    });
    mockUseMe.mockReturnValue({
      data: meAdmin,
      isLoading: false,
      isFetching: false,
    });
  });

  it('muestra email, rol y tenant desde /v1/me (no nombre genérico stale)', () => {
    renderNavbar();
    expect(screen.getByText('gerencia@vethosia.com')).toBeInTheDocument();
    expect(screen.getByText('Admin Entidad')).toBeInTheDocument();
    expect(screen.getByText('Vethosia Operaciones')).toBeInTheDocument();
    expect(screen.queryByText('Prueba Veterinario Vethosia')).not.toBeInTheDocument();
  });

  it('muestra Veterinario en el header cuando rol=vet', () => {
    mockUseMe.mockReturnValue({
      data: { ...meAdmin, rol: 'vet' },
      isLoading: false,
      isFetching: false,
    });
    renderNavbar();
    expect(screen.getByText('Veterinario')).toBeInTheDocument();
  });

  it('no mezcla perfil si me.uid no coincide con firebaseUser', () => {
    mockUseAuth.mockReturnValue({
      firebaseUser: { uid: 'u2' },
      logout: vi.fn(),
    });
    mockUseMe.mockReturnValue({
      data: meAdmin,
      isLoading: true,
      isFetching: true,
    });
    renderNavbar();
    expect(screen.getByText('Cargando perfil…')).toBeInTheDocument();
    expect(screen.queryByText('gerencia@vethosia.com')).not.toBeInTheDocument();
  });

  it('vet legacy ve flujo clinico pero no gestion administrativa', () => {
    mockUseMe.mockReturnValue({
      data: { ...meAdmin, rol: 'vet' },
      isLoading: false,
      isFetching: false,
    });
    renderNavbar();
    expect(screen.getByRole('link', { name: /pacientes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /agenda/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /brigadas/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /entidad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /veterinarias/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /suscripci[o\u00f3]n/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /soporte plataforma/i })).not.toBeInTheDocument();
  });

  it('vet independiente conserva acceso a su suscripción propia', () => {
    mockUseMe.mockReturnValue({
      data: { ...meAdmin, rol: 'vet', orgId: null },
      isLoading: false,
      isFetching: false,
    });
    renderNavbar();
    expect(screen.getByRole('link', { name: /pacientes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /suscripci[o\u00f3]n/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /entidad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /veterinarias/i })).not.toBeInTheDocument();
  });

  it('admin legacy ve modulos de admin_entidad sin rutas clinicas operativas', () => {
    renderNavbar();
    expect(screen.getByRole('link', { name: /vista entidad/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sedes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^brigadas$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /veterinarias/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /suscripci[o\u00f3]n/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /pacientes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^agenda$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^vacunas$/i })).not.toBeInTheDocument();
  });

  it('admin_entidad y admin_veterinaria muestran modulos separados', () => {
    mockUseMe.mockReturnValue({
      data: { ...meAdmin, rol: 'admin_entidad' },
      isLoading: false,
      isFetching: false,
    });
    const adminEntidadView = renderNavbar();
    expect(screen.getByText('Admin Entidad')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /vista entidad/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sedes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^brigadas$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /veterinarias/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^agenda$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^vacunas$/i })).not.toBeInTheDocument();
    adminEntidadView.unmount();

    mockUseMe.mockReturnValue({
      data: { ...meAdmin, rol: 'admin_veterinaria' },
      isLoading: false,
      isFetching: false,
    });
    renderNavbar();
    expect(screen.getByText('Admin Veterinaria')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /veterinarias/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pacientes/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /vista entidad/i })).not.toBeInTheDocument();
  });

  it('usa role V2 admin_veterinaria sobre rol legacy admin', () => {
    mockUseMe.mockReturnValue({
      data: {
        ...meAdmin,
        rol: 'admin',
        role: 'admin_veterinaria',
        veterinariaId: 'vetclin_1',
        entidadId: 'ent_1',
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
      },
      isLoading: false,
      isFetching: false,
    });
    renderNavbar();
    expect(screen.getByText('Admin Veterinaria')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /veterinarias/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pacientes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /suscripci[o\u00f3]n/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /vista entidad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /soporte plataforma/i })).not.toBeInTheDocument();
  });

  it('admin_veterinaria con nombre y organizacion largos queda en contenedor truncable', () => {
    mockUseMe.mockReturnValue({
      data: {
        ...meAdmin,
        nombre: 'Admin Veterinaria Vethosia',
        rol: 'admin',
        role: 'admin_veterinaria',
        organizacionNombre: 'Vethosia Operaciones Regional Centro y Norte',
        veterinariaId: 'vetclin_1',
        entidadId: 'ent_1',
        membershipId: 'mem_1',
      },
      isLoading: false,
      isFetching: false,
    });

    renderNavbar();

    const profile = screen.getByTestId('navbar-user-profile');
    const details = screen.getByTestId('navbar-user-details');
    const name = screen.getByText('Admin Veterinaria Vethosia');
    const org = screen.getByText('Vethosia Operaciones Regional Centro y Norte');

    expect(profile.className).toContain('overflow-hidden');
    expect(profile.className).toContain('max-w-[12rem]');
    expect(details.className).toContain('min-w-0');
    expect(name.className).toContain('truncate');
    expect(org.className).toContain('truncate');
    expect(screen.getAllByRole('button', { name: /notificaciones/i }).length).toBeGreaterThan(0);
    expect(screen.getByTitle(/cerrar sesi/i)).toBeInTheDocument();
  });

  it('superadmin ve soporte/plataforma', () => {
    mockUseMe.mockReturnValue({
      data: { ...meAdmin, rol: 'superadmin' },
      isLoading: false,
      isFetching: false,
    });
    renderNavbar();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /soporte plataforma/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /vista entidad/i })).not.toBeInTheDocument();
  });

  it('R123: asistente legacy no ve opciones de navegacion V2', () => {
    mockUseMe.mockReturnValue({
      data: { ...meAdmin, rol: 'asistente' },
      isLoading: false,
      isFetching: false,
    });
    renderNavbar();
    expect(screen.getByText('Rol legacy')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /pacientes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /agenda/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /nuevo paciente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /entidad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /veterinarias/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /suscripci[o\u00f3]n/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /soporte plataforma/i })).not.toBeInTheDocument();
  });
});
