import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminEntidadCommandCenter from './AdminEntidadCommandCenter';

vi.mock('../../features/metricas/api', () => ({
  obtenerMetricas: vi.fn().mockResolvedValue({
    alcance: 'entidad',
    pacientes: 10,
    consultas: 14,
    consultasAprobadas: 9,
    soapUsados: 12,
    soapLimite: 100,
    citas: 5,
    vacunas: 6,
    vacunasProximas: 2,
    vacunasVencidas: 1,
    cumplimientoVacunacion: 80,
    topDiagnosticos: [],
    consolidadoVeterinarias: [
      { veterinariaId: 'vetA', pacientes: 6, consultas: 8, soapGenerados: 7, vacunasVencidas: 1, citasProgramadas: 2 },
    ],
    consumoIaPorVeterinario: [
      { veterinarioId: 'vet1', usados: 4, limite: 20, porcentaje: 20, bloqueado: false },
    ],
  }),
  obtenerConsumo: vi.fn().mockResolvedValue({
    periodo: '2026-06',
    usados: 12,
    limite: 100,
    restante: 88,
    porcentaje: 12,
    alcanzo80: false,
    bloqueado: false,
  }),
}));

vi.mock('../../features/saas/api', () => ({
  miSuscripcion: vi.fn().mockResolvedValue({
    suscripcion: { id: 'sub1', planId: 'plan-entidad', estado: 'activa', ciclo: 'mensual' },
    asientos: { usados: 4, max: 20 },
  }),
}));

function renderCenter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminEntidadCommandCenter
          me={{ uid: 'adminEnt', role: 'admin_entidad', rol: 'admin', entidadId: 'entA' } as never}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminEntidadCommandCenter', () => {
  it('muestra operacion multi-sede, consumo maestro y cobertura pending profesional', async () => {
    renderCenter();

    expect(await screen.findByTestId('admin-entidad-command-center')).toBeInTheDocument();
    expect(await screen.findByText(/Cantidad de pacientes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Sedes$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Veterinarios por sede$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Freelancers$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Consumo consolidado$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Cobertura territorial/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Configuraci[oó]n pendiente/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Soporte plataforma/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nueva consulta/i)).not.toBeInTheDocument();
  });
});
