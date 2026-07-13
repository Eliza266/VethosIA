import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Pacientes from './Pacientes';

const pacientesMock = Array.from({ length: 12 }, (_, i) => ({
  id: `p${i + 1}`,
  nombre: i === 0 ? 'Mailo' : `Paciente ${i + 1}`,
  especie: i % 2 === 0 ? 'gato' : 'perro',
  raza: 'Mestizo',
  sexo: 'macho',
  estadoReproductivo: 'entero',
  propietario: { nombre: 'Ana Valentina Castro', telefono: '3226614400' },
  ultimoPeso: i < 6 ? 4.2 : undefined,
  creadoEn: new Date(),
}));

vi.mock('../hooks/usePacientes', () => ({
  usePacientes: () => ({ pacientes: pacientesMock, loading: false, error: null }),
}));

vi.mock('../features/citas/api', () => ({
  listarCitas: vi.fn().mockResolvedValue([]),
}));

function renderPacientes() {
  return render(
    <MemoryRouter>
      <Pacientes />
    </MemoryRouter>,
  );
}

describe('Pacientes', () => {
  it('muestra el titulo con el total y las pildoras de KPI, sin la pestaña de métricas', async () => {
    renderPacientes();
    expect(await screen.findByText(/^Pacientes$/i)).toBeInTheDocument();
    expect(screen.getByText(/total/i)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/Con cita/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin peso/i)).toBeInTheDocument();
    expect(screen.queryByText(/Distribución por Especie/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Análisis de Peso y Cuidado/i)).not.toBeInTheDocument();
  });

  it('los filtros de especie quedan colapsados hasta que se abren', async () => {
    const user = userEvent.setup();
    renderPacientes();

    expect(screen.queryByRole('button', { name: /Perros/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Filtros/i }));
    expect(await screen.findByRole('button', { name: /Perros/i })).toBeInTheDocument();
  });

  it('la vista por defecto es la tabla compacta, con guion cuando no hay cita próxima', async () => {
    renderPacientes();
    expect(await screen.findByText('Mailo')).toBeInTheDocument();
    expect(screen.getAllByText('–').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Sin cita próxima/i)).not.toBeInTheDocument();
  });

  it('pagina los resultados a 8 por página', async () => {
    const user = userEvent.setup();
    renderPacientes();

    expect(await screen.findByText(/Mostrando 1-8 de 12 pacientes/i)).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /página siguiente/i }));
    expect(await screen.findByText(/Mostrando 9-12 de 12 pacientes/i)).toBeInTheDocument();
  });
});
