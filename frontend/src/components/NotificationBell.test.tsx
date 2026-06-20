import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NotificationBell from './NotificationBell';

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

function renderBell() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>
        <NotificationBell />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotificaciones.mockReturnValue({
      data: [
        {
          id: 'n1',
          tipo: 'vacunas_pendientes',
          titulo: 'Vacuna vencida',
          cuerpo: 'Rabia pendiente',
          leida: false,
          resourcePath: '/vacunas',
        },
      ],
      noLeidas: 1,
      marcarLeida: mockMarcarLeida,
      marcarTodas: mockMarcarTodas,
    });
  });

  it('muestra contador, marca todas y navega al recurso', async () => {
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: /notificaciones \(1 sin leer\)/i }));
    expect(screen.getByText('Vacuna vencida')).toBeInTheDocument();
    expect(screen.getByText('Vacuna')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ejecutar jobs/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /marcar todas/i }));
    expect(mockMarcarTodas.mutate).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Vacuna vencida'));
    expect(mockMarcarLeida.mutate).toHaveBeenCalledWith('n1');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/vacunas'));
  });

  it('limita el ancho del panel para no generar overflow en mobile', () => {
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: /notificaciones \(1 sin leer\)/i }));

    const panel = screen.getByTestId('notification-panel');
    expect(panel).toHaveStyle({ maxWidth: 'calc(100vw - 2rem)' });
  });

  it('cierra al hacer click fuera del panel', () => {
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: /notificaciones \(1 sin leer\)/i }));
    expect(screen.getByTestId('notification-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('notification-backdrop'));
    expect(screen.queryByTestId('notification-panel')).not.toBeInTheDocument();
  });
});
