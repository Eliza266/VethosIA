import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VeterinarioCommandCenter from './VeterinarioCommandCenter';

vi.mock('../../features/metricas/api', () => ({
  obtenerMetricas: vi.fn().mockResolvedValue({
    alcance: 'individual',
    pacientes: 1,
    consultas: 1,
    consultasAprobadas: 1,
    soapUsados: 2,
    soapLimite: 30,
    citas: 0,
    vacunas: 1,
    vacunasProximas: 1,
    vacunasVencidas: 0,
    cumplimientoVacunacion: 100,
    topDiagnosticos: [],
  }),
  obtenerConsumo: vi.fn().mockResolvedValue({
    periodo: '2026-07',
    usados: 2,
    limite: 30,
    restante: 28,
    porcentaje: 7,
    alcanzo80: false,
    bloqueado: false,
  }),
}));

function renderCenter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <VeterinarioCommandCenter
          me={{ uid: 'vet1', rol: 'vet', nombre: 'Dra. Demo Veterinaria' } as never}
          user={null}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VeterinarioCommandCenter', () => {
  it('va directo a las métricas sin encabezado ni accesos rápidos', async () => {
    renderCenter();

    expect(await screen.findByTestId('veterinario-command-center')).toBeInTheDocument();
    expect(await screen.findByText(/Cantidad de pacientes/i)).toBeInTheDocument();
    expect(screen.queryByText(/Centro cl[ií]nico/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prioridad cl[ií]nica/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vista entidad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Soporte plataforma/i)).not.toBeInTheDocument();
  });

  it('muestra el panel de metricas con graficos', async () => {
    renderCenter();

    expect(await screen.findByText(/Cantidad de pacientes/i)).toBeInTheDocument();
    expect(screen.getByText(/Cantidad de consultas/i)).toBeInTheDocument();
    expect(screen.getByText(/Cupo de IA/i)).toBeInTheDocument();
  });

  it('renderiza sin romper en ancho mobile', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    window.dispatchEvent(new Event('resize'));

    renderCenter();

    expect(await screen.findByTestId('veterinario-command-center')).toBeInTheDocument();
    expect(await screen.findByText(/Cantidad de pacientes/i)).toBeInTheDocument();
  });
});
