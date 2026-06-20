import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiagnosticoEstructuradoPanel from './DiagnosticoEstructuradoPanel';

describe('DiagnosticoEstructuradoPanel', () => {
  it('muestra diagnosticos estructurados en solo lectura', () => {
    render(
      <DiagnosticoEstructuradoPanel
        value={[
          {
            id: 'd1',
            nombre: 'Gastroenteritis',
            tipo: 'principal',
            estado: 'presuntivo',
            origen: 'ia',
            creadoEn: '2026-06-18T00:00:00.000Z',
          },
        ]}
        analisisTexto="Dolor abdominal leve"
      />,
    );

    expect(screen.getByText('Gastroenteritis')).toBeInTheDocument();
    expect(screen.getByText('principal')).toBeInTheDocument();
    expect(screen.getByText('presuntivo')).toBeInTheDocument();
  });

  it('usa texto libre existente cuando no hay diagnostico estructurado', () => {
    render(<DiagnosticoEstructuradoPanel analisisTexto="Otitis externa probable" />);

    expect(screen.getByText(/Diagnostico textual:/i)).toBeInTheDocument();
    expect(screen.getByText(/Otitis externa probable/i)).toBeInTheDocument();
  });

  it('permite agregar editar y eliminar diagnosticos antes de aprobar', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <DiagnosticoEstructuradoPanel editable analisisTexto="Texto clinico original" onChange={onChange} />,
    );

    await user.click(screen.getByRole('button', { name: /agregar/i }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ tipo: 'principal', estado: 'presuntivo', origen: 'manual' }),
    ]);

    const created = onChange.mock.calls.at(-1)?.[0];
    rerender(
      <DiagnosticoEstructuradoPanel
        editable
        value={created}
        analisisTexto="Texto clinico original"
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Nombre diagnostico 1'), {
      target: { value: 'Dermatitis' },
    });
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ nombre: 'Dermatitis' }),
    ]);

    await user.click(screen.getByLabelText('Eliminar diagnostico 1'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
