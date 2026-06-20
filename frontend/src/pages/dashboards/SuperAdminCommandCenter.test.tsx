import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SuperAdminCommandCenter from './SuperAdminCommandCenter';

vi.mock('../../features/metricas/api', () => ({
  obtenerMetricas: vi.fn().mockResolvedValue({
    alcance: 'global',
    pacientes: 20,
    consultas: 30,
    consultasAprobadas: 22,
    soapUsados: 40,
    soapLimite: 300,
    citas: 10,
    vacunas: 8,
    vacunasProximas: 3,
    vacunasVencidas: 1,
    cumplimientoVacunacion: 88,
    topDiagnosticos: [],
  }),
}));

function renderCenter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SuperAdminCommandCenter me={{ uid: 'root', role: 'superadmin', rol: 'superadmin' } as never} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SuperAdminCommandCenter', () => {
  it('muestra operacion plataforma con estados profesionales y no flujo clinico tenant', async () => {
    renderCenter();

    expect(await screen.findByTestId('superadmin-command-center')).toBeInTheDocument();
    expect(screen.getByText(/Operaci[oó]n Plataforma/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Entidades$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Veterinarias$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Usuarios y miembros$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Planes$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Suscripciones$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Pagos y cobros$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gesti[oó]n centralizada/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Configuraci[oó]n pendiente/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Nueva consulta/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Pacientes$/i)).not.toBeInTheDocument();
  });
});
