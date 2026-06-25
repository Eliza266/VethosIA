import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Paciente } from '../types';

const {
  mockNavigate,
  mockGetPaciente,
  mockCrearConsulta,
  mockActualizarConsulta,
  mockProcesarAudioConsulta,
  mockGetUserMedia,
  mockUseAuth,
  mockUseBrigadas,
  mockRegistrarAtencionBrigada,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetPaciente: vi.fn(),
  mockCrearConsulta: vi.fn(),
  mockActualizarConsulta: vi.fn(),
  mockProcesarAudioConsulta: vi.fn(),
  mockGetUserMedia: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseBrigadas: vi.fn(),
  mockRegistrarAtencionBrigada: vi.fn(),
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
    getPaciente: mockGetPaciente,
    loading: false,
  }),
}));

vi.mock('../hooks/useConsultas', () => ({
  useConsultas: () => ({
    crearConsulta: mockCrearConsulta,
    actualizarConsulta: mockActualizarConsulta,
    procesarAudioConsulta: mockProcesarAudioConsulta,
    error: null,
  }),
}));

vi.mock('../features/auth/hooks', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../hooks/useBrigadas', () => ({
  useBrigadas: () => mockUseBrigadas(),
}));

vi.mock('../features/brigadas/api', () => ({
  registrarAtencionBrigada: mockRegistrarAtencionBrigada,
}));

import NuevaConsulta from './NuevaConsulta';

const paciente: Paciente = {
  id: 'p1',
  nombre: 'Luna',
  especie: 'perro',
  sexo: 'hembra',
  estadoReproductivo: 'esterilizado',
  propietario: { nombre: 'Ana', telefono: '300' },
  veterinarioId: 'vet1',
  creadoEn: new Date(),
};

function renderNuevaConsulta() {
  return render(
    <MemoryRouter initialEntries={['/pacientes/p1/consultas/nueva']}>
      <Routes>
        <Route path="/pacientes/:pacienteId/consultas/nueva" element={<NuevaConsulta />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NuevaConsulta manual fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPaciente.mockResolvedValue(paciente);
    mockCrearConsulta.mockResolvedValue('c1');
    mockActualizarConsulta.mockResolvedValue(true);
    mockProcesarAudioConsulta.mockResolvedValue(true);
    mockGetUserMedia.mockRejectedValue(new Error('microfono no disponible'));
    mockUseAuth.mockReturnValue({ user: { uid: 'vet1' } });
    mockUseBrigadas.mockReturnValue({ brigadas: [] });
    mockRegistrarAtencionBrigada.mockResolvedValue({});
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: mockGetUserMedia },
    });
  });

  it('muestra consulta manual si falla el acceso al microfono', async () => {
    renderNuevaConsulta();

    await screen.findAllByText(/luna/i);
    fireEvent.click(screen.getByTitle(/iniciar/i));

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    expect(await screen.findByRole('form', { name: /consulta manual/i })).toBeInTheDocument();
  });

  it('guarda borrador SOAP manual sin procesar audio ni aprobar consumo', async () => {
    renderNuevaConsulta();

    await screen.findAllByText(/luna/i);
    fireEvent.click(screen.getByRole('button', { name: /consulta manual/i }));
    fireEvent.change(screen.getByLabelText(/^motivo$/i), { target: { value: 'Control general' } });
    fireEvent.change(screen.getByLabelText(/^peso kg$/i), { target: { value: '12,5' } });
    fireEvent.change(screen.getByLabelText(/^condicion corporal$/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/^subjetivo$/i), { target: { value: 'Come normal' } });
    fireEvent.change(screen.getByLabelText(/^objetivo$/i), { target: { value: 'Mucosas rosadas' } });
    fireEvent.change(screen.getByLabelText(/^analisis$/i), { target: { value: 'Paciente estable' } });
    fireEvent.change(screen.getByLabelText(/^plan$/i), { target: { value: 'Control en 30 dias' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar borrador manual/i }));

    await waitFor(() => {
      expect(mockCrearConsulta).toHaveBeenCalledWith('p1', undefined);
      expect(mockActualizarConsulta).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({
          motivo: 'Control general',
          prioridad: 'rutina',
          estado: 'borrador',
          signosVitales: expect.objectContaining({
            peso: 12.5,
            condicionCorporal: 3,
          }),
          soap: expect.objectContaining({
            subjetivo: 'Come normal',
            objetivo: 'Mucosas rosadas',
            analisis: 'Paciente estable',
            plan: 'Control en 30 dias',
            generadoPorIA: false,
          }),
        }),
      );
    });
    expect(mockProcesarAudioConsulta).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/pacientes/p1/consultas/c1');
  });

  it('muestra selector de brigadas si hay activas hoy y registra atencion al guardar', async () => {
    const hoyStr = (() => {
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, '0');
      const dd = String(hoy.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    })();

    mockUseBrigadas.mockReturnValue({
      brigadas: [
        {
          id: 'b1',
          nombre: 'Brigada del Dia',
          fecha: hoyStr,
          estado: 'en_curso',
          ubicacion: { ciudad: 'Bogota' },
          veterinarioIds: ['vet1'],
        },
      ],
    });

    renderNuevaConsulta();

    await screen.findAllByText(/luna/i);
    expect(await screen.findByLabelText(/¿Esta consulta pertenece a una brigada\?/i)).toBeInTheDocument();

    // Select the brigada
    fireEvent.change(screen.getByLabelText(/¿Esta consulta pertenece a una brigada\?/i), {
      target: { value: 'b1' },
    });

    // Open manual consultation
    fireEvent.click(screen.getByRole('button', { name: /consulta manual/i }));
    fireEvent.change(screen.getByLabelText(/^motivo$/i), { target: { value: 'Chequeo rutinario' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar borrador manual/i }));

    await waitFor(() => {
      expect(mockCrearConsulta).toHaveBeenCalledWith('p1', undefined);
      expect(mockRegistrarAtencionBrigada).toHaveBeenCalledWith('b1', {
        consultaId: 'c1',
        pacienteId: 'p1',
        motivo: 'Chequeo rutinario',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/pacientes/p1/consultas/c1');
    });
  });
});
