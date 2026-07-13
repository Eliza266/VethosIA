import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../hooks/usePacientes', () => ({
  usePacientes: () => ({
    pacientes: [
      { id: 'p1', nombre: 'Firulais', especie: 'perro' },
      { id: 'p2', nombre: 'Michi', especie: 'gato' },
    ],
  }),
}));

vi.mock('../features/vacunas/api', () => ({
  listarVacunas: vi.fn(),
  marcarVacunaAplicada: vi.fn(),
  etiquetaEstadoVacuna: (e?: string) => (e === 'vencida' ? 'Vencida' : 'Próxima'),
  toDateInput: (iso?: string) => (iso ? iso.slice(0, 10) : ''),
}));

import Vacunas from './Vacunas';
import { listarVacunas, marcarVacunaAplicada } from '../features/vacunas/api';

const vacunasMock = vi.mocked({ listarVacunas, marcarVacunaAplicada });

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Vacunas />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('Vacunas page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vacunasMock.listarVacunas.mockResolvedValue([
      {
        id: 'v1',
        pacienteId: 'p1',
        nombre: 'Rabia',
        especie: 'perro',
        proximaDosis: '2026-06-20',
        estado: 'proxima_a_vencer',
      },
      {
        id: 'v2',
        pacienteId: 'p2',
        nombre: 'Triple felina',
        especie: 'gato',
        proximaDosis: '2026-01-01',
        estado: 'vencida',
      },
    ]);
    vacunasMock.marcarVacunaAplicada.mockResolvedValue({
      id: 'v1',
      pacienteId: 'p1',
      nombre: 'Rabia',
      aplicada: '2026-06-18',
    });
  });

  it('muestra listado con contadores y permite marcar aplicada', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Rabia')).toBeInTheDocument();
    expect(screen.getByText('Triple felina')).toBeInTheDocument();
    expect(screen.getAllByText('Firulais').length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('button', { name: /marcar aplicada/i })[0]);
    await waitFor(() => {
      expect(vacunasMock.marcarVacunaAplicada).toHaveBeenCalledWith('p1', 'v1');
    });
  });

  it('envia filtros por estado especie paciente y tipo', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Rabia');

    await user.click(screen.getByRole('tab', { name: 'Vencidas' }));
    await user.selectOptions(screen.getByLabelText('Filtrar por especie'), 'gato');
    await user.type(screen.getByLabelText('Filtrar por paciente'), 'Michi');
    await user.type(screen.getByLabelText('Filtrar por tipo'), 'Triple felina');

    await waitFor(() => {
      expect(vacunasMock.listarVacunas).toHaveBeenLastCalledWith({
        estado: 'vencida',
        especie: 'gato',
        pacienteId: 'p2',
        tipo: 'Triple felina',
      });
    });
  });
});
