import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Brigadas from './Brigadas';

const {
  mockUseMe,
  mockUseBrigadas,
  mockListarVeterinariasBackoffice,
  mockListarMiembrosBackoffice,
  mockListarAtencionesBrigada,
  mockObtenerConsolidadoBrigada,
  mockRegistrarAtencionBrigada,
  mockCrearBrigada,
  mockActualizarBrigada,
} = vi.hoisted(() => ({
  mockUseMe: vi.fn(),
  mockUseBrigadas: vi.fn(),
  mockListarVeterinariasBackoffice: vi.fn(),
  mockListarMiembrosBackoffice: vi.fn(),
  mockListarAtencionesBrigada: vi.fn(),
  mockObtenerConsolidadoBrigada: vi.fn(),
  mockRegistrarAtencionBrigada: vi.fn(),
  mockCrearBrigada: vi.fn(),
  mockActualizarBrigada: vi.fn(),
}));

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

vi.mock('../hooks/useBrigadas', () => ({
  useBrigadas: () => mockUseBrigadas(),
}));

vi.mock('../features/backoffice/api', () => ({
  listarVeterinariasBackoffice: mockListarVeterinariasBackoffice,
  listarMiembrosBackoffice: mockListarMiembrosBackoffice,
}));

vi.mock('../features/brigadas/api', () => ({
  listarAtencionesBrigada: mockListarAtencionesBrigada,
  obtenerConsolidadoBrigada: mockObtenerConsolidadoBrigada,
  registrarAtencionBrigada: mockRegistrarAtencionBrigada,
}));

const brigada = {
  id: 'b1',
  nombre: 'Brigada Norte',
  descripcion: 'Barrio norte',
  fecha: '2026-07-01',
  ubicacion: { direccion: 'Parque', ciudad: 'Bogota' },
  veterinarioIds: ['vet1'],
  entidadId: 'ent_1',
  veterinariaId: 'vetclin_1',
  estado: 'planificada' as const,
  creadoEn: new Date('2026-07-01T00:00:00.000Z'),
};

function setup(role: 'admin_entidad' | 'admin_veterinaria' | 'veterinario' = 'admin_entidad') {
  vi.clearAllMocks();
  mockUseMe.mockReturnValue({
    data: {
      uid: role === 'veterinario' ? 'vet1' : 'admin1',
      rol: role === 'veterinario' ? 'vet' : 'admin',
      role,
      entidadId: 'ent_1',
      veterinariaId: role === 'admin_entidad' ? null : 'vetclin_1',
    },
  });
  mockUseBrigadas.mockReturnValue({
    brigadas: [brigada],
    loading: false,
    error: null,
    crearBrigada: mockCrearBrigada.mockResolvedValue('b-new'),
    actualizarBrigada: mockActualizarBrigada.mockResolvedValue(true),
  });
  mockListarVeterinariasBackoffice.mockResolvedValue([
    {
      id: 'vetclin_1',
      nombre: 'Clinica Norte',
      entidadId: 'ent_1',
      accountId: 'vetclin_1',
      accountType: 'veterinaria',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      estado: 'activa',
    },
  ]);
  mockListarMiembrosBackoffice.mockResolvedValue([
    {
      id: 'm1',
      uid: 'vet1',
      email: 'vet1@clinica.com',
      rol: 'vet',
      role: 'veterinario',
      veterinariaId: 'vetclin_1',
      accountId: 'vetclin_1',
      estado: 'activo',
      bloqueado: false,
    },
  ]);
  mockListarAtencionesBrigada.mockResolvedValue([
    {
      id: 'a1',
      brigadaId: 'b1',
      veterinarioId: 'vet1',
      motivo: 'Vacunacion',
      fechaHora: '2026-07-01T10:00:00.000Z',
      createdBy: 'vet1',
    },
  ]);
  mockObtenerConsolidadoBrigada.mockResolvedValue({
    brigadaId: 'b1',
    nombre: 'Brigada Norte',
    estado: 'planificada',
    fecha: '2026-07-01',
    totalAtenciones: 1,
    pacientesUnicos: 1,
    veterinariosParticipantes: 1,
    veterinariosConAtencion: 1,
  });
  mockRegistrarAtencionBrigada.mockResolvedValue({
    id: 'a2',
    brigadaId: 'b1',
    veterinarioId: 'vet1',
    motivo: 'Control',
    fechaHora: '2026-07-01T11:00:00.000Z',
    createdBy: 'vet1',
  });
  render(
    <MemoryRouter>
      <Brigadas />
    </MemoryRouter>
  );
}

describe('Brigadas', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('admin entidad ve selector de sede propia, participantes y crea payload seguro', async () => {
    setup('admin_entidad');

    fireEvent.click(screen.getByRole('button', { name: /nueva brigada/i }));
    expect(await screen.findByLabelText('Sede')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: 'Brigada Sur' } });
    fireEvent.change(screen.getByLabelText(/Fecha/), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText(/Ciudad/), { target: { value: 'Cali' } });
    fireEvent.change(screen.getByLabelText('Sede'), { target: { value: 'vetclin_1' } });
    fireEvent.click(await screen.findByLabelText(/vet1@clinica\.com/i));
    fireEvent.click(screen.getByRole('button', { name: /crear brigada/i }));

    await waitFor(() => {
      expect(mockCrearBrigada).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Brigada Sur',
          veterinariaId: 'vetclin_1',
          veterinarioIds: ['vet1'],
        }),
      );
    });
  });

  it('admin veterinaria no ve selector global de sede', async () => {
    setup('admin_veterinaria');
    fireEvent.click(screen.getByRole('button', { name: /nueva brigada/i }));
    await screen.findByLabelText(/Nombre/);
    expect(screen.queryByLabelText('Sede')).not.toBeInTheDocument();
    expect(await screen.findByLabelText(/vet1@clinica\.com/i)).toBeInTheDocument();
  });

  it('veterinario no ve selector global y registra atención con payload propio', async () => {
    setup('veterinario');
    expect(screen.queryByRole('button', { name: /nueva brigada/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /brigada norte/i }));
    expect(await screen.findByText('Atenciones registradas')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Motivo/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Sede')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Control general' } });
    fireEvent.change(screen.getByLabelText('Especie'), { target: { value: 'canino' } });
    fireEvent.click(screen.getByRole('button', { name: /registrar atenci[oó]n/i }));

    await waitFor(() => {
      expect(mockRegistrarAtencionBrigada).toHaveBeenCalledWith('b1', {
        motivo: 'Control general',
        especie: 'canino',
        notas: undefined,
        pacienteId: undefined,
        consultaId: undefined,
      });
    });
  });

  it('muestra error de validacion sin pantalla blanca', async () => {
    setup('admin_entidad');
    fireEvent.click(screen.getByRole('button', { name: /nueva brigada/i }));
    fireEvent.click(await screen.findByRole('button', { name: /crear brigada/i }));
    expect(await screen.findByText('Nombre, fecha y ciudad son obligatorios.')).toBeInTheDocument();
  });
});
