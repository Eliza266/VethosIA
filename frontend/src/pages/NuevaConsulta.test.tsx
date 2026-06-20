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
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetPaciente: vi.fn(),
  mockCrearConsulta: vi.fn(),
  mockActualizarConsulta: vi.fn(),
  mockProcesarAudioConsulta: vi.fn(),
  mockGetUserMedia: vi.fn(),
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
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: mockGetUserMedia },
    });
  });

  it('muestra consulta manual si falla el acceso al microfono', async () => {
    renderNuevaConsulta();

    await screen.findByText(/luna/i);
    fireEvent.click(screen.getByTitle(/iniciar/i));

    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(await screen.findByRole('form', { name: /consulta manual/i })).toBeInTheDocument();
  });

  it('guarda borrador SOAP manual sin procesar audio ni aprobar consumo', async () => {
    renderNuevaConsulta();

    await screen.findByText(/luna/i);
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
});
