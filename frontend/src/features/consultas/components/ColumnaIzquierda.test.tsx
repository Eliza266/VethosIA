import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ColumnaIzquierda from './ColumnaIzquierda';
import type { Consulta } from '../../../types';
import type { EditDataConsulta } from '../types';

const baseConsulta = (over: Partial<Consulta>): Consulta => ({
  pacienteId: 'p1',
  veterinarioId: 'v1',
  fechaHora: new Date(),
  creadoEn: new Date(),
  estado: 'aprobada',
  ...over,
});

const editData: EditDataConsulta = {
  motivo: '',
  prioridad: 'rutina',
  signosVitales: {},
};

const noop = () => {};

describe('ColumnaIzquierda · reproductor multi-bloque', () => {
  it('renderiza un <audio> por cada URL en audioUrls', () => {
    const consulta = baseConsulta({
      audioUrl: 'https://x/0.webm',
      audioUrls: ['https://x/0.webm', 'https://x/1.webm', 'https://x/2.webm'],
    });
    render(<ColumnaIzquierda consulta={consulta} editData={editData} onChangeEditData={noop} />);

    const players = screen
      .getAllByLabelText(/Reproducir audio bloque/i)
      .map((el) => el.getAttribute('src'));
    expect(players).toEqual(['https://x/0.webm', 'https://x/1.webm', 'https://x/2.webm']);
    expect(screen.getByText(/3 bloques/i)).toBeInTheDocument();
  });

  it('cae a audioUrl (legacy) cuando no hay audioUrls', () => {
    const consulta = baseConsulta({ audioUrl: 'https://x/solo.webm' });
    render(<ColumnaIzquierda consulta={consulta} editData={editData} onChangeEditData={noop} />);

    const players = screen.getAllByLabelText(/Reproducir audio bloque/i);
    expect(players).toHaveLength(1);
    expect(players[0].getAttribute('src')).toBe('https://x/solo.webm');
    // un solo bloque no muestra el contador
    expect(screen.queryByText(/bloques/i)).not.toBeInTheDocument();
  });

  it('no renderiza el panel de audio si no hay grabación', () => {
    const consulta = baseConsulta({});
    render(<ColumnaIzquierda consulta={consulta} editData={editData} onChangeEditData={noop} />);
    expect(screen.queryByLabelText(/Reproducir audio bloque/i)).not.toBeInTheDocument();
  });
});
