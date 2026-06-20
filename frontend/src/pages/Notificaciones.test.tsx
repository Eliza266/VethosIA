import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Notificaciones from './Notificaciones';

const { mockUseNotificaciones, mockMarcarLeida, mockMarcarTodas } = vi.hoisted(() => ({
  mockUseNotificaciones: vi.fn(),
  mockMarcarLeida: { mutate: vi.fn(), isPending: false },
  mockMarcarTodas: { mutate: vi.fn(), isPending: false },
}));

vi.mock('../features/notificaciones/hooks', () => ({
  useNotificaciones: () => mockUseNotificaciones(),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/notificaciones']}>
        <Notificaciones />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Notificaciones page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotificaciones.mockReturnValue({
      data: [
        {
          id: 'n1',
          tipo: 'cita_recordatorio',
          titulo: 'Cita proxima',
          cuerpo: 'Max en dos horas',
          leida: false,
          resourcePath: '/agenda',
        },
        {
          id: 'n2',
          tipo: 'consulta_aprobada',
          titulo: 'Consulta aprobada',
          cuerpo: 'HC lista',
          leida: false,
          resourceType: 'consulta',
          resourceId: 'c1',
          resourcePath: 'consultas/c1',
          pacienteId: 'p1',
          consultaId: 'c1',
        },
        {
          id: 'n3',
          tipo: 'invitacion_expirada',
          titulo: 'Invitacion expirada',
          cuerpo: 'Sin recurso disponible',
          leida: true,
        },
      ],
      isLoading: false,
      isError: false,
      noLeidas: 2,
      marcarLeida: mockMarcarLeida,
      marcarTodas: mockMarcarTodas,
    });
  });

  it('lista, marca todas y navega con resourcePath', async () => {
    renderPage();

    expect(screen.getByText('2 sin leer')).toBeInTheDocument();
    expect(screen.getByText('Cita proxima')).toBeInTheDocument();
    expect(screen.getByText('Cita')).toBeInTheDocument();
    expect(screen.getByText('Invitacion')).toBeInTheDocument();
    expect(screen.getByText('Recurso no disponible')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ejecutar jobs/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /marcar todas/i }));
    expect(mockMarcarTodas.mutate).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Cita proxima'));
    expect(mockMarcarLeida.mutate).toHaveBeenCalledWith('n1');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/agenda'));
  });

  it('navega al detalle de consulta y marca como leida', async () => {
    renderPage();

    fireEvent.click(screen.getByText('Consulta aprobada'));

    expect(mockMarcarLeida.mutate).toHaveBeenCalledWith('n2');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/pacientes/p1/consultas/c1'));
  });
});
