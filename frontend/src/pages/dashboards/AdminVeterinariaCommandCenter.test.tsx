import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminVeterinariaCommandCenter from './AdminVeterinariaCommandCenter';

vi.mock('../../hooks/usePacientes', () => ({
  usePacientes: () => ({
    pacientes: [{ id: 'p1', nombre: 'Luna', especie: 'perro' }],
    loading: false,
  }),
}));

vi.mock('../../features/citas/api', () => ({
  listarCitasProximas2h: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../features/metricas/api', () => ({
  obtenerMetricas: vi.fn().mockResolvedValue({
    alcance: 'veterinaria',
    pacientes: 1,
    consultas: 4,
    consultasAprobadas: 3,
    soapUsados: 6,
    soapLimite: 30,
    citas: 2,
    vacunas: 2,
    vacunasProximas: 1,
    vacunasVencidas: 0,
    cumplimientoVacunacion: 90,
    topDiagnosticos: [{ nombre: 'Otitis', total: 2 }],
  }),
  obtenerConsumo: vi.fn().mockResolvedValue({
    periodo: '2026-06',
    usados: 6,
    limite: 30,
    restante: 24,
    porcentaje: 20,
    alcanzo80: false,
    bloqueado: false,
  }),
}));

vi.mock('../../features/saas/api', () => ({
  miSuscripcion: vi.fn().mockResolvedValue({
    suscripcion: { id: 'sub1', planId: 'plan-pro', estado: 'activa', ciclo: 'mensual' },
    asientos: { usados: 2, max: 5 },
  }),
}));

function renderCenter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminVeterinariaCommandCenter
          me={{ uid: 'adminVet', role: 'admin_veterinaria', rol: 'admin', veterinariaId: 'vetA', planOwnerId: 'adminVet' } as never}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminVeterinariaCommandCenter', () => {
  it('muestra operación de clínica y no módulos de entidad/superadmin', async () => {
    renderCenter();

    expect(await screen.findByTestId('admin-veterinaria-command-center')).toBeInTheDocument();
    expect(screen.getByText(/Operaci[oó]n de Cl[ií]nica/i)).toBeInTheDocument();
    expect(screen.getByText(/Control de sede/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Mi veterinaria/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Equipo/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pacientes de sede/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Plan\/Suscripci[oó]n/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Plan, consumo y estado/i)).toBeInTheDocument();
    expect(screen.queryByText(/Vista entidad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Soporte plataforma/i)).not.toBeInTheDocument();
  });
});
