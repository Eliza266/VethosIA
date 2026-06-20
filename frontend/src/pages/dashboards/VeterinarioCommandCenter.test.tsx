import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VeterinarioCommandCenter from './VeterinarioCommandCenter';

const { mockFetchTodasConsultas } = vi.hoisted(() => ({
  mockFetchTodasConsultas: vi.fn(),
}));

vi.mock('../../hooks/usePacientes', () => ({
  usePacientes: () => ({
    pacientes: [
      {
        id: 'p1',
        nombre: 'Luna',
        especie: 'perro',
        sexo: 'hembra',
        estadoReproductivo: 'entero',
        propietario: { nombre: 'Demo', telefono: '300' },
        veterinarioId: 'vet1',
        creadoEn: new Date(),
      },
    ],
    loading: false,
  }),
}));

vi.mock('../../hooks/useConsultas', () => ({
  useConsultas: () => ({ fetchTodasConsultas: mockFetchTodasConsultas }),
}));

vi.mock('../../features/citas/api', () => ({
  listarCitas: vi.fn().mockResolvedValue([]),
  listarCitasProximas2h: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../features/vacunas/api', () => ({
  resumenVacunasPendientes: vi.fn().mockResolvedValue({ proximas: 1, vencidas: 0 }),
}));

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
  beforeEach(() => {
    mockFetchTodasConsultas.mockResolvedValue([
      {
        id: 'c1',
        pacienteId: 'p1',
        estado: 'aprobada',
        fechaHora: new Date().toISOString(),
        soap: { subjetivo: 'ok' },
      },
      {
        id: 'c2',
        pacienteId: 'p1',
        estado: 'borrador',
        fechaHora: new Date(Date.now() - 86_400_000).toISOString(),
      },
    ]);
  });

  it('prioriza flujo clinico y oculta modulos admin', async () => {
    renderCenter();

    expect(await screen.findByTestId('veterinario-command-center')).toBeInTheDocument();
    expect(screen.getByText(/Centro cl[ií]nico/i)).toBeInTheDocument();
    expect(screen.getByText(/Prioridad cl[ií]nica/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Nueva consulta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Pacientes$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Agenda$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Vacunas$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Consulta SOAP$/i)).toBeInTheDocument();
    expect(screen.queryByText(/Documentos controlados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^PDF cl[ií]nico$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vista entidad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Soporte plataforma/i)).not.toBeInTheDocument();
  });

  it('muestra acciones documentales compactas en consultas aprobadas', async () => {
    renderCenter();

    const row = await screen.findByTestId('consulta-reciente-c1');
    expect(within(row).getByRole('link', { name: /^Ver SOAP$/i })).toHaveAttribute(
      'href',
      '/pacientes/p1/consultas/c1',
    );
    expect(within(row).getByRole('link', { name: /^PDF$/i })).toHaveAttribute(
      'href',
      '/pacientes/p1/consultas/c1?documento=pdf',
    );
    expect(within(row).getByRole('link', { name: /^Email demo$/i })).toHaveAttribute(
      'href',
      '/pacientes/p1/consultas/c1?documento=email',
    );
    expect(within(row).getByRole('link', { name: /^WhatsApp seguro$/i })).toHaveAttribute(
      'href',
      '/pacientes/p1/consultas/c1?documento=whatsapp',
    );

    const borrador = await screen.findByTestId('consulta-reciente-c2');
    expect(within(borrador).getByText(/Documentos disponibles despu[eé]s de aprobaci[oó]n cl[ií]nica/i)).toBeInTheDocument();
  });

  it('renderiza sin romper en ancho mobile', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    window.dispatchEvent(new Event('resize'));

    renderCenter();

    expect(await screen.findByTestId('veterinario-command-center')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Nueva consulta/i })[0]).toHaveAttribute('href', '/pacientes');
  });
});
