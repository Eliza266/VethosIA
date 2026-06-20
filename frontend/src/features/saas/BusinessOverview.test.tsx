import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BusinessOverview from './BusinessOverview';
import type { RbacProfileLike, Rol } from '../../lib/rbac';

const { mockMiSuscripcion, mockObtenerConsumo } = vi.hoisted(() => ({
  mockMiSuscripcion: vi.fn(),
  mockObtenerConsumo: vi.fn(),
}));

vi.mock('./api', () => ({
  miSuscripcion: mockMiSuscripcion,
}));

vi.mock('../metricas/api', () => ({
  obtenerConsumo: mockObtenerConsumo,
}));

function renderOverview(rol: Rol | null, profile?: RbacProfileLike | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <BusinessOverview rol={rol} profile={profile} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BusinessOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMiSuscripcion.mockResolvedValue({
      suscripcion: {
        id: 'sub1',
        planId: 'plan-pro',
        estado: 'activa',
        ciclo: 'mensual',
        vigenteHasta: '2026-07-01T00:00:00.000Z',
      },
      asientos: { usados: 2, max: 5 },
    });
    mockObtenerConsumo.mockResolvedValue({
      periodo: '2026-06',
      usados: 8,
      limite: 10,
      restante: 2,
      porcentaje: 80,
      alcanzo80: true,
      bloqueado: false,
    });
  });

  it('muestra plan, estado y consumo para admin entidad', async () => {
    renderOverview('admin_entidad');

    expect(await screen.findByText('Plan, consumo y estado')).toBeInTheDocument();
    expect(screen.getByText('Consumo agregado entidad')).toBeInTheDocument();
    expect(await screen.findByText('plan-pro')).toBeInTheDocument();
    expect(screen.getByText('Al día')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /uso del plan/i })).toHaveAttribute('aria-valuenow', '80');
    expect(screen.getByText(/Alerta: consumo alto del plan/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /gestionar suscripci[o\u00f3]n/i })).toBeInTheDocument();
  });

  it('separa consumo de veterinaria y no muestra CTA de plan al veterinario', async () => {
    const adminView = renderOverview('admin_veterinaria', {
      role: 'admin_veterinaria',
      rol: 'admin',
      veterinariaId: 'vetclin_1',
      planOwnerType: 'veterinaria',
      planOwnerId: 'vetclin_1',
    });
    expect(await screen.findByText('Consumo de veterinaria')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /gestionar suscripci[o\u00f3]n/i })).toBeInTheDocument();
    adminView.unmount();

    renderOverview('veterinario', { rol: 'veterinario', orgId: 'orgA' });
    expect(await screen.findByText('Consumo personal/cuenta')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /gestionar suscripci[o\u00f3]n/i })).not.toBeInTheDocument();
  });

  it('admin_veterinaria con plan heredado ve estado sin CTA de gestion', async () => {
    renderOverview('admin_veterinaria', {
      role: 'admin_veterinaria',
      rol: 'admin',
      veterinariaId: 'vetclin_1',
      entidadId: 'ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
    });

    expect(await screen.findByText('Consumo de veterinaria')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /gestionar suscripci[o\u00f3]n/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Plan heredado de la entidad/i)).toBeInTheDocument();
  });
});
