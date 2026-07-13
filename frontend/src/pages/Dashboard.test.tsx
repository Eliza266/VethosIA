import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockAuthUser, mockUseMe } = vi.hoisted(() => ({
  mockAuthUser: { uid: 'u1', nombre: 'Vet Test' },
  mockUseMe: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mockAuthUser }),
}));

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    Navigate: vi.fn(({ to, replace }) => (
      <div data-testid="navigate-mock" data-to={to} data-replace={replace ? 'true' : 'false'} />
    )),
  };
});

vi.mock('../hooks/usePacientes', () => ({
  usePacientes: () => ({
    pacientes: [
      {
        id: 'p1',
        nombre: 'Andiel',
        especie: 'perro',
        sexo: 'macho',
        estadoReproductivo: 'entero',
        propietario: { nombre: 'Dueno', telefono: '300' },
        veterinarioId: 'u1',
        creadoEn: new Date(),
      },
    ],
    loading: false,
  }),
}));

vi.mock('../hooks/useConsultas', () => ({
  useConsultas: () => ({ fetchTodasConsultas: vi.fn().mockResolvedValue([]) }),
}));

vi.mock('../features/citas/api', () => ({
  listarCitas: vi.fn().mockResolvedValue([]),
  listarCitasProximas2h: vi.fn().mockResolvedValue([]),
}));

vi.mock('../features/vacunas/api', () => ({
  resumenVacunasPendientes: vi.fn().mockResolvedValue({ proximas: 1, vencidas: 0 }),
}));

vi.mock('../features/metricas/api', () => ({
  obtenerMetricas: vi.fn().mockResolvedValue({
    alcance: 'individual',
    pacientes: 1,
    consultas: 2,
    consultasAprobadas: 1,
    soapUsados: 4,
    soapLimite: 10,
    vacunas: 1,
    vacunasProximas: 1,
    vacunasVencidas: 0,
    citas: 0,
    cumplimientoVacunacion: 100,
    topDiagnosticos: [{ nombre: 'Otitis', total: 1 }],
    consolidadoVeterinarias: [{ veterinariaId: 'vetA', pacientes: 1, consultas: 2, soapGenerados: 2, vacunasVencidas: 0, citasProgramadas: 1 }],
    consumoIaPorVeterinario: [{ veterinarioId: 'vet1', usados: 2, limite: 10, porcentaje: 20, bloqueado: false }],
  }),
  obtenerConsumo: vi.fn().mockResolvedValue({
    periodo: '2026-06',
    usados: 4,
    limite: 10,
    restante: 6,
    porcentaje: 40,
    alcanzo80: false,
    bloqueado: false,
  }),
}));

vi.mock('../features/saas/api', () => ({
  miSuscripcion: vi.fn().mockResolvedValue({
    suscripcion: { id: 'sub1', planId: 'plan-pro', estado: 'activa', ciclo: 'mensual' },
    asientos: { usados: 1, max: 3 },
  }),
}));

import Dashboard from './Dashboard';

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Dashboard role command center router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMe.mockReturnValue({
      data: { uid: 'u1', rol: 'vet' },
      isLoading: false,
      isFetching: false,
    });
  });

  it('renderiza el panel de veterinario y no muestra modulos admin', async () => {
    renderDashboard();

    expect(await screen.findByTestId('veterinario-command-center')).toBeInTheDocument();
    expect(await screen.findByText(/Cantidad de pacientes/i)).toBeInTheDocument();
    expect(screen.queryByTestId('admin-entidad-command-center')).not.toBeInTheDocument();
    expect(screen.queryByTestId('superadmin-command-center')).not.toBeInTheDocument();
  });

  it('renderiza el panel de admin_veterinaria', async () => {
    mockUseMe.mockReturnValue({
      data: { uid: 'u1', role: 'admin_veterinaria', rol: 'admin', veterinariaId: 'vetA' },
      isLoading: false,
      isFetching: false,
    });

    renderDashboard();

    expect(await screen.findByTestId('admin-veterinaria-command-center')).toBeInTheDocument();
    expect(await screen.findByText(/Cantidad de pacientes/i)).toBeInTheDocument();
    expect(screen.queryByTestId('admin-entidad-command-center')).not.toBeInTheDocument();
    expect(screen.queryByTestId('superadmin-command-center')).not.toBeInTheDocument();
  });

  it('renderiza el panel de admin_entidad sin panel clínico individual principal', async () => {
    mockUseMe.mockReturnValue({
      data: { uid: 'u1', role: 'admin_entidad', rol: 'admin', entidadId: 'entA' },
      isLoading: false,
      isFetching: false,
    });

    renderDashboard();

    expect(await screen.findByTestId('admin-entidad-command-center')).toBeInTheDocument();
    expect(screen.getAllByText(/Cobertura territorial/i).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('veterinario-command-center')).not.toBeInTheDocument();
    expect(screen.queryByTestId('superadmin-command-center')).not.toBeInTheDocument();
  });

  it('redirecciona a /admin para superadmin sin renderizar flujo clinico', async () => {
    mockUseMe.mockReturnValue({
      data: { uid: 'u1', role: 'superadmin', rol: 'superadmin' },
      isLoading: false,
      isFetching: false,
    });

    renderDashboard();

    const nav = await screen.findByTestId('navigate-mock');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveAttribute('data-to', '/admin');
    expect(nav).toHaveAttribute('data-replace', 'true');
    expect(screen.queryByTestId('veterinario-command-center')).not.toBeInTheDocument();
  });

  it('mantiene fallback controlado para rol legacy sin modulos V2', async () => {
    mockUseMe.mockReturnValue({
      data: { uid: 'u1', rol: 'asistente' },
      isLoading: false,
      isFetching: false,
    });

    renderDashboard();

    expect(await screen.findByTestId('dashboard-fallback')).toBeInTheDocument();
    expect(screen.getByText(/Rol sin centro operativo habilitado/i)).toBeInTheDocument();
  });
});
