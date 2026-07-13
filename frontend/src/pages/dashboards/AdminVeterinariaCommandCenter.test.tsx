import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminVeterinariaCommandCenter from './AdminVeterinariaCommandCenter';

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
  it('muestra directo las métricas sin encabezado ni accesos rápidos', async () => {
    renderCenter();

    expect(await screen.findByTestId('admin-veterinaria-command-center')).toBeInTheDocument();
    expect(await screen.findByText(/Cantidad de pacientes/i)).toBeInTheDocument();
    expect(screen.getByText(/Cantidad de consultas/i)).toBeInTheDocument();
    expect(screen.queryByText(/Operaci[oó]n de Cl[ií]nica/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Control de sede/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Plan, consumo y estado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Accesos r[aá]pidos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vista entidad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Soporte plataforma/i)).not.toBeInTheDocument();
  });
});
