import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModulePlaceholder, NotFound } from './RouteFallback';

describe('RouteFallback', () => {
  it('muestra placeholder controlado para modulos incompletos', () => {
    render(
      <MemoryRouter>
        <ModulePlaceholder
          title="Auditoria"
          description="Ruta reservada para el modulo dedicado."
          targetLabel="Ir a soporte plataforma"
          targetPath="/admin"
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('region', { name: /auditoria/i })).toBeInTheDocument();
    expect(screen.getByText(/ruta reservada/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir a soporte plataforma/i })).toHaveAttribute('href', '/admin');
  });

  it('muestra catch-all 404 con regreso al dashboard', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByRole('region', { name: /ruta no encontrada/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver al dashboard/i })).toHaveAttribute('href', '/');
  });
});
