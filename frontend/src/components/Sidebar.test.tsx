import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sidebar from './Sidebar';

const mockUseAuth = vi.fn();
const mockUseMe = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

function renderSidebar(initialPath = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Sidebar />
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
};

describe('Sidebar (roles y RBAC)', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ firebaseUser: { uid: 'u1' }, logout: vi.fn() });
    mockUseMe.mockReturnValue({ data: meAdmin, isLoading: false, isFetching: false });
  });

  it('marca de la app y navegación accesibles', () => {
    renderSidebar();
    expect(screen.getByRole('navigation', { name: /navegación principal/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/vethos ai, inicio/i)).toBeInTheDocument();
  });

  it('muestra email, rol y tenant desde /v1/me', () => {
    renderSidebar();
    expect(screen.getByText('gerencia@vethosia.com')).toBeInTheDocument();
    expect(screen.getByText('Admin Entidad')).toBeInTheDocument();
    expect(screen.getByText('Vethosia Operaciones')).toBeInTheDocument();
  });

  it('estado de carga cuando me.uid no coincide', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: { uid: 'u2' }, logout: vi.fn() });
    mockUseMe.mockReturnValue({ data: meAdmin, isLoading: true, isFetching: true });
    renderSidebar();
    expect(screen.getByText('Cargando perfil…')).toBeInTheDocument();
    expect(screen.queryByText('gerencia@vethosia.com')).not.toBeInTheDocument();
  });

  it('vet ve flujo clínico pero no gestión administrativa', () => {
    mockUseMe.mockReturnValue({ data: { ...meAdmin, rol: 'vet' }, isLoading: false, isFetching: false });
    renderSidebar();
    expect(screen.getByRole('link', { name: /pacientes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /agenda/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /brigadas/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /vista entidad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /veterinarias/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /soporte plataforma/i })).not.toBeInTheDocument();
  });

  it('vet independiente conserva su suscripción', () => {
    mockUseMe.mockReturnValue({ data: { ...meAdmin, rol: 'vet', orgId: null }, isLoading: false, isFetching: false });
    renderSidebar();
    expect(screen.getByRole('link', { name: /pacientes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /suscripci[o\u00f3]n/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /vista entidad/i })).not.toBeInTheDocument();
  });

  it('admin_entidad ve módulos de entidad, no clínicos', () => {
    mockUseMe.mockReturnValue({ data: { ...meAdmin, rol: 'admin_entidad' }, isLoading: false, isFetching: false });
    renderSidebar();
    expect(screen.getByText('Admin Entidad')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /vista entidad/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sedes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^brigadas$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /veterinarias/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^agenda$/i })).not.toBeInTheDocument();
  });

  it('admin_veterinaria ve su scope', () => {
    mockUseMe.mockReturnValue({
      data: { ...meAdmin, rol: 'admin', role: 'admin_veterinaria', veterinariaId: 'v1', entidadId: 'e1' },
      isLoading: false,
      isFetching: false,
    });
    renderSidebar();
    expect(screen.getByText('Admin Veterinaria')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /veterinarias/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pacientes/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /vista entidad/i })).not.toBeInTheDocument();
  });

  it('superadmin muestra las 9 secciones de plataforma', () => {
    mockUseMe.mockReturnValue({ data: { ...meAdmin, rol: 'superadmin' }, isLoading: false, isFetching: false });
    renderSidebar('/admin');
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    for (const name of [/dashboard/i, /entidades/i, /veterinarias/i, /usuarios/i, /planes/i, /suscripciones/i, /pagos/i, /auditoría/i, /configuración/i]) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('asistente legacy no ve navegación V2', () => {
    mockUseMe.mockReturnValue({ data: { ...meAdmin, rol: 'asistente' }, isLoading: false, isFetching: false });
    renderSidebar();
    expect(screen.getByText('Rol legacy')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /pacientes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /agenda/i })).not.toBeInTheDocument();
  });

  it('vet en detalle de paciente muestra tabs contextuales (nivel 3)', () => {
    mockUseMe.mockReturnValue({ data: { ...meAdmin, rol: 'vet' }, isLoading: false, isFetching: false });
    renderSidebar('/pacientes/abc123?tab=vacunas');
    expect(screen.getByRole('link', { name: /^perfil$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^consultas$/i })).toBeInTheDocument();
  });
});
