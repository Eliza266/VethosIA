import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SoapViewer from '../../../components/SoapViewer';

describe('SoapViewer', () => {
  it('guarda SOAP textual sin acoplar diagnostico estructurado', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <SoapViewer
        soap={{
          subjetivo: 'Tos desde ayer',
          objetivo: 'Mucosas rosadas',
          analisis: 'Traqueobronquitis como diagnostico presuntivo.',
          plan: 'Control en 72 horas',
          generadoPorIA: true,
        }}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar nota/i }));
    await user.click(screen.getByRole('button', { name: /^guardar/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        analisis: 'Traqueobronquitis como diagnostico presuntivo.',
        generadoPorIA: true,
      }),
    );
  });
});
