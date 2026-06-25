import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const {
  mockNavigate,
  mockCrearMutate,
  mockCambiarEstadoMutate,
  mockCambiarEstadoMutateAsync,
  mockVincularPacienteMutate,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCrearMutate: vi.fn(),
  mockCambiarEstadoMutate: vi.fn(),
  mockCambiarEstadoMutateAsync: vi.fn(),
  mockVincularPacienteMutate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../hooks/usePacientes', () => ({
  usePacientes: () => ({
    pacientes: [
      { id: 'p1', nombre: 'Luna', especie: 'perro' },
      { id: 'p2', nombre: 'Rex', especie: 'perro' },
    ],
  }),
}));

type MockCita = { id: string };
type MockCalProps = { citas: MockCita[]; onSelectCita: (c: MockCita) => void };

vi.mock('../features/citas/CalendarioCitas', () => {
  const MockCalendario = ({ citas, onSelectCita }: MockCalProps) => (
    <div data-testid="mock-calendario">
      {citas.map((c) => (
        <button key={c.id} onClick={() => onSelectCita(c)}>
          Ver Cita {c.id}
        </button>
      ))}
    </div>
  );
  return {
    __esModule: true,
    default: MockCalendario,
    CalendarioCitas: MockCalendario,
  };
});

vi.mock('../features/citas/hooks', () => ({
  useCitas: () => {
    // Set baseline hours to noon to avoid date/week boundary crossings during tests
    const fechaBase = new Date();
    fechaBase.setHours(12, 0, 0, 0);
    const fechaSuelta = new Date(fechaBase.getTime() + 30 * 60 * 1000).toISOString();
    const fechaVinculada = new Date(fechaBase.getTime() + 60 * 60 * 1000).toISOString();
    return {
      data: [
        {
          id: 'cita-suelta',
          titulo: 'Luna',
          fecha: fechaSuelta,
          estado: 'programada',
          motivo: 'Vacuna',
        },
        {
          id: 'cita-p1',
          titulo: 'Control Luna',
          fecha: fechaVinculada,
          estado: 'programada',
          pacienteId: 'p1',
          pacienteNombre: 'Luna',
          motivo: 'Control general',
        },
      ],
      isLoading: false,
      crear: { mutate: mockCrearMutate, isPending: false },
      cambiarEstado: {
        mutate: mockCambiarEstadoMutate,
        mutateAsync: mockCambiarEstadoMutateAsync,
        isPending: false,
      },
      vincularPaciente: { mutate: mockVincularPacienteMutate, isPending: false },
    };
  },
}));

import Agenda from './Agenda';

function renderAgenda() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Agenda />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Agenda page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCambiarEstadoMutateAsync.mockResolvedValue({ id: 'cita-p1', estado: 'en_atencion' });
  });

  it('crea cita vinculada a paciente con payload /v1', async () => {
    const user = userEvent.setup();
    renderAgenda();

    // Click Nueva Cita button to open the modal
    const openBtn = screen.getByRole('button', { name: /nueva cita/i });
    await user.click(openBtn);

    await user.selectOptions(screen.getByLabelText('Paciente'), 'p1');
    await user.type(screen.getByLabelText('Motivo de la cita'), 'Control vacuna');
    await user.type(screen.getByLabelText('Fecha y hora'), '2026-06-20T09:30');
    await user.click(screen.getByRole('button', { name: 'Agendar' }));

    expect(mockCrearMutate).toHaveBeenCalledWith({
      pacienteId: 'p1',
      motivo: 'Control vacuna',
      fecha: new Date('2026-06-20T09:30').toISOString(),
    });
  });

  it('vincula cita sin paciente usando paciente sugerido', async () => {
    const user = userEvent.setup();
    renderAgenda();

    const eventBtn = await screen.findByRole('button', { name: /ver cita cita-suelta/i });
    await user.click(eventBtn);

    const vincular = await screen.findByRole('button', { name: 'Vincular' });
    await user.click(vincular);

    expect(mockVincularPacienteMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cita-suelta', pacienteId: 'p1' }),
      expect.any(Object)
    );
  });

  it('abre atencion desde cita programada y navega a nueva consulta con citaId', async () => {
    const user = userEvent.setup();
    renderAgenda();

    const eventBtn = await screen.findByRole('button', { name: /ver cita cita-p1/i });
    await user.click(eventBtn);

    await user.click(screen.getByRole('button', { name: /atender \/ crear consulta/i }));

    await waitFor(() => {
      expect(mockCambiarEstadoMutateAsync).toHaveBeenCalledWith({ id: 'cita-p1', estado: 'en_atencion' });
      expect(mockNavigate).toHaveBeenCalledWith('/pacientes/p1/consultas/nueva?citaId=cita-p1');
    });
  });
});
