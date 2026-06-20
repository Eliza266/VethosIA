import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PacienteCard from './PacienteCard';
import type { Paciente } from '../types';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const basePaciente: Paciente = {
  id: 'p1',
  nombre: 'Firulais',
  especie: 'perro',
  sexo: 'macho',
  estadoReproductivo: 'entero',
  propietario: { nombre: 'Juan', telefono: '300' },
  veterinarioId: 'v1',
  creadoEn: new Date(),
};

describe('PacienteCard', () => {
  it('muestra la foto cuando paciente.foto existe', () => {
    render(
      <MemoryRouter>
        <PacienteCard
          paciente={{ ...basePaciente, foto: 'https://example.com/foto.jpg' }}
        />
      </MemoryRouter>,
    );
    const img = screen.getByRole('img', { name: 'Firulais' });
    expect(img).toHaveAttribute('src', 'https://example.com/foto.jpg');
  });

  it('usa inicial como fallback si no hay foto', () => {
    render(
      <MemoryRouter>
        <PacienteCard paciente={basePaciente} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('F')).toBeInTheDocument();
  });
});
