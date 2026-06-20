import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockUseMe = vi.fn();

vi.mock('../tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

vi.mock('./api', () => ({
  listarVacunasPaciente: vi.fn(),
  crearVacuna: vi.fn(),
  actualizarVacuna: vi.fn(),
  marcarVacunaAplicada: vi.fn(),
  eliminarVacuna: vi.fn(),
  etiquetaEstadoVacuna: (e?: string) =>
    e === 'vencida' ? 'Vencida' : e === 'proxima_a_vencer' ? 'Próxima' : 'Al día',
  fechaVacuna: (v: { aplicada?: string; proximaDosis?: string }) => v.aplicada ?? v.proximaDosis,
  toDateInput: (iso?: string) => (iso ? iso.slice(0, 10) : ''),
}));

import VacunasPanel from './VacunasPanel';
import { UIProviders } from '../../components/ui/Primitives';
import {
  listarVacunasPaciente,
  crearVacuna,
  actualizarVacuna,
  marcarVacunaAplicada,
  eliminarVacuna,
} from './api';

const vacunasMock = vi.mocked({
  listarVacunasPaciente,
  crearVacuna,
  actualizarVacuna,
  marcarVacunaAplicada,
  eliminarVacuna,
});

function renderPanel(
  pacienteId = 'p1',
  pacienteEspecie: 'perro' | 'gato' | 'ave' | 'reptil' | 'otro' = 'otro',
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <UIProviders>
        <VacunasPanel pacienteId={pacienteId} pacienteEspecie={pacienteEspecie} />
      </UIProviders>
    </QueryClientProvider>,
  );
}

describe('VacunasPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMe.mockReturnValue({ data: { rol: 'vet' } });
    vacunasMock.listarVacunasPaciente.mockResolvedValue([
      {
        id: 'v1',
        pacienteId: 'p1',
        nombre: 'Rabia',
        proximaDosis: '2026-12-01',
        estado: 'proxima_a_vencer',
      },
    ]);
    vacunasMock.crearVacuna.mockResolvedValue({
      id: 'v2',
      pacienteId: 'p1',
      nombre: 'Triple felina',
    });
    vacunasMock.actualizarVacuna.mockResolvedValue({
      id: 'v1',
      pacienteId: 'p1',
      nombre: 'Rabia anual',
    });
    vacunasMock.marcarVacunaAplicada.mockResolvedValue({
      id: 'v1',
      pacienteId: 'p1',
      nombre: 'Rabia',
      aplicada: '2026-06-18',
    });
    vacunasMock.eliminarVacuna.mockResolvedValue(undefined);
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('muestra vacunas con nombre, fecha y estado', async () => {
    renderPanel();
    expect(await screen.findByText('Rabia')).toBeInTheDocument();
    expect(screen.getAllByText('Próxima').length).toBeGreaterThan(0);
  });

  it('muestra catalogo base por especie y permite registrarla aplicada', async () => {
    const user = userEvent.setup();
    renderPanel('p1', 'gato');

    expect(await screen.findByText('Catálogo base por especie')).toBeInTheDocument();
    expect(screen.getByText('Triple felina')).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText('Seleccionar vacuna del catalogo'),
      'gato-triple-felina',
    );
    expect(screen.getByLabelText('Nombre de la vacuna')).toHaveValue('Triple felina');

    await user.click(screen.getByRole('button', { name: /registrar/i }));
    await waitFor(() => {
      expect(vacunasMock.crearVacuna).toHaveBeenCalledWith(
        expect.objectContaining({
          pacienteId: 'p1',
          nombre: 'Triple felina',
          catalogoCodigo: 'gato-triple-felina',
          fuente: 'catalogo_base',
          aplicada: expect.any(String),
        }),
      );
    });
  });

  it('permite editar una vacuna', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Rabia');
    await user.click(screen.getByRole('button', { name: /editar rabia/i }));
    const input = screen.getByLabelText('Editar nombre');
    await user.clear(input);
    await user.type(input, 'Rabia anual');
    await user.click(screen.getByRole('button', { name: /guardar/i }));
    await waitFor(() => {
      expect(vacunasMock.actualizarVacuna).toHaveBeenCalledWith('p1', 'v1', {
        nombre: 'Rabia anual',
        proximaDosis: '2026-12-01',
      });
    });
  });

  it('permite marcar una vacuna vencida/proxima como aplicada', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Rabia');
    await user.click(screen.getByRole('button', { name: /marcar aplicada rabia/i }));
    await waitFor(() => {
      expect(vacunasMock.marcarVacunaAplicada).toHaveBeenCalledWith(
        'p1',
        'v1',
        expect.objectContaining({ aplicada: expect.any(String) }),
      );
    });
  });

  it('vet archiva con confirmacion y conserva historial', async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Rabia');
    await user.click(screen.getByRole('button', { name: /archivar rabia/i }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^archivar$/i }));
    await waitFor(() => {
      expect(vacunasMock.eliminarVacuna).toHaveBeenCalledWith('p1', 'v1');
    });
  });

  it('admin veterinaria con scope ve boton archivar', async () => {
    mockUseMe.mockReturnValue({
      data: { role: 'admin_veterinaria', rol: 'admin', veterinariaId: 'vetclin_1' },
    });
    renderPanel();
    await screen.findByText('Rabia');
    expect(screen.getByRole('button', { name: /archivar rabia/i })).toBeInTheDocument();
  });

  it('admin entidad NO ve boton archivar', async () => {
    mockUseMe.mockReturnValue({ data: { rol: 'admin' } });
    renderPanel();
    await screen.findByText('Rabia');
    expect(screen.queryByRole('button', { name: /archivar rabia/i })).not.toBeInTheDocument();
  });

  it('asistente NO ve boton archivar', async () => {
    mockUseMe.mockReturnValue({ data: { rol: 'asistente' } });
    renderPanel();
    await screen.findByText('Rabia');
    expect(screen.queryByRole('button', { name: /archivar rabia/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar rabia/i })).toBeInTheDocument();
  });
});
