import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Consulta } from '../../types';
import EvolucionClinicaPanel from './EvolucionClinicaPanel';

const consulta = (id: string, fechaHora: string, signosVitales?: Consulta['signosVitales']): Consulta => ({
  id,
  pacienteId: 'p1',
  veterinarioId: 'v1',
  fechaHora: new Date(fechaHora),
  signosVitales,
  estado: 'aprobada',
  creadoEn: new Date(fechaHora),
});

describe('EvolucionClinicaPanel', () => {
  it('muestra constantes reales recientes', () => {
    render(
      <EvolucionClinicaPanel
        consultas={[
          consulta('c1', '2026-06-01T10:00:00Z', { peso: 10 }),
          consulta('c2', '2026-06-15T10:00:00Z', {
            peso: 11,
            temperatura: 38.5,
            frecuenciaCardiaca: 90,
            frecuenciaRespiratoria: 22,
            pulso: 'regular',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Ultimo peso')).toBeInTheDocument();
    expect(screen.getByText('11 kg')).toBeInTheDocument();
    expect(screen.getByText('38.5 C')).toBeInTheDocument();
    expect(screen.getByText('regular')).toBeInTheDocument();
    expect(screen.getByText(/Tendencia peso: Sube/i)).toBeInTheDocument();
  });

  it('muestra estado vacio sin inventar signos', () => {
    render(<EvolucionClinicaPanel consultas={[consulta('c1', '2026-06-01T10:00:00Z')]} />);

    expect(screen.getByText('Sin constantes registradas')).toBeInTheDocument();
    expect(screen.queryByText('Ultimo peso')).not.toBeInTheDocument();
  });
});
