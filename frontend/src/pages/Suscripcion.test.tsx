import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Suscripcion from './Suscripcion';

const {
  mockMiSuscripcion,
  mockListarPlanes,
  mockCrearCheckout,
  mockEstadoCuentaPagos,
  mockPagosConfigMe,
  mockObtenerConsumo,
  mockUseMe,
} = vi.hoisted(() => ({
  mockMiSuscripcion: vi.fn(),
  mockListarPlanes: vi.fn(),
  mockCrearCheckout: vi.fn(),
  mockEstadoCuentaPagos: vi.fn(),
  mockPagosConfigMe: vi.fn(),
  mockObtenerConsumo: vi.fn(),
  mockUseMe: vi.fn(),
}));

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

vi.mock('../features/saas/api', () => ({
  miSuscripcion: mockMiSuscripcion,
  listarPlanes: mockListarPlanes,
  crearCheckout: mockCrearCheckout,
  estadoCuentaPagos: mockEstadoCuentaPagos,
  pagosConfigMe: mockPagosConfigMe,
}));

vi.mock('../features/metricas/api', () => ({
  obtenerConsumo: mockObtenerConsumo,
}));

function renderSuscripcion() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Suscripcion />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Suscripcion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMe.mockReturnValue({
      data: { uid: 'u1', rol: 'admin_entidad', role: 'admin_entidad' },
    });
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
    mockListarPlanes.mockResolvedValue([
      {
        id: 'plan-plus',
        nombre: 'Plan Plus',
        precioMensualCOP: 99000,
        precioAnualCOP: 999000,
        asientosMax: 5,
        limiteHistoriasMes: 100,
        historiasGratisTrial: 10,
        tipo: 'ambos',
        activo: true,
      },
    ]);
    mockObtenerConsumo.mockResolvedValue({
      periodo: '2026-06',
      usados: 65,
      limite: 100,
      restante: 35,
      porcentaje: 65,
      alcanzo80: false,
      bloqueado: false,
    });
    mockEstadoCuentaPagos.mockResolvedValue({
      cartera: { estado: 'al_dia', diasVencido: 0, requierePago: false },
      recibos: [],
    });
    mockPagosConfigMe.mockResolvedValue({
      planOwnerId: 'orgA',
      planOwnerType: 'entidad',
      provider: 'wompi',
      estado: 'configurado',
      checkoutDisponible: true,
      puedeConfigurar: true,
      updatedAt: null,
    });
    mockCrearCheckout.mockResolvedValue({
      reference: 'ref-safe',
      amountInCents: 99900000,
      currency: 'COP',
      publicKey: 'pk',
      signature: 'sig',
      planId: 'plan-plus',
      subscriptionId: 'sub1',
    });
  });

  it('muestra plan, consumo y estado vacio de recibos sin datos falsos', async () => {
    renderSuscripcion();

    expect(await screen.findByText('Clínica Pro')).toBeInTheDocument();
    expect(screen.getAllByText('Al día').length).toBeGreaterThan(0);
    expect(screen.getByRole('progressbar', { name: /uso del plan/i })).toHaveAttribute('aria-valuenow', '65');
    expect(screen.getByText('Sin recibos recientes')).toBeInTheDocument();
  });

  it('inicia checkout enviando solo planId y ciclo cuando Wompi esta configurado', async () => {
    renderSuscripcion();

    fireEvent.change(await screen.findByLabelText('Plan'), { target: { value: 'plan-plus' } });
    fireEvent.change(screen.getByLabelText('Ciclo de facturación'), { target: { value: 'anual' } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar pago con wompi/i }));

    await waitFor(() => {
      expect(mockCrearCheckout).toHaveBeenCalledWith({ planId: 'plan-plus', ciclo: 'anual' });
    });
    expect(mockCrearCheckout.mock.calls[0][0]).not.toHaveProperty('amountInCents');
    expect(await screen.findByText(/ref-safe/)).toBeInTheDocument();
  });

  it('muestra pagos no configurados y deshabilita checkout', async () => {
    mockPagosConfigMe.mockResolvedValue({
      planOwnerId: 'orgA',
      planOwnerType: 'entidad',
      provider: 'wompi',
      estado: 'incompleto',
      checkoutDisponible: false,
      puedeConfigurar: true,
      updatedAt: null,
    });

    renderSuscripcion();

    expect((await screen.findAllByText(/Pagos en l[i\u00ed]nea no configurados/i)).length).toBeGreaterThan(0);
    // Sin Wompi configurado (Fase 1), el checkout se reemplaza por las tarjetas
    // de planes con boton de WhatsApp en vez de un boton de pago deshabilitado.
    expect(screen.getByRole('heading', { name: /planes disponibles/i })).toBeInTheDocument();
    // El formulario de configuracion de Wompi queda oculto mientras los pagos
    // sigan siendo manuales.
    expect(screen.queryByRole('region', { name: /configurar pagos wompi/i })).not.toBeInTheDocument();
  });

  it('asistente no ve CTA de configuración Wompi', async () => {
    mockUseMe.mockReturnValue({
      data: { uid: 'u1', rol: 'asistente' },
    });
    mockPagosConfigMe.mockResolvedValue({
      planOwnerId: 'orgA',
      planOwnerType: 'entidad',
      provider: 'wompi',
      estado: 'incompleto',
      checkoutDisponible: false,
      puedeConfigurar: false,
      updatedAt: null,
    });

    renderSuscripcion();

    expect((await screen.findAllByText(/Pagos en l[i\u00ed]nea no configurados/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('region', { name: /configurar pagos wompi/i })).not.toBeInTheDocument();
  });

  it('admin_veterinaria con plan heredado ve suscripción solo lectura sin checkout ni Wompi', async () => {
    mockUseMe.mockReturnValue({
      data: {
        uid: 'adminVet',
        rol: 'admin',
        role: 'admin_veterinaria',
        orgId: 'orgA',
        veterinariaId: 'vetclin_1',
        entidadId: 'ent_1',
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
      },
    });
    mockPagosConfigMe.mockResolvedValue({
      planOwnerId: 'ent_1',
      planOwnerType: 'entidad',
      provider: 'wompi',
      estado: 'configurado',
      checkoutDisponible: true,
      puedeConfigurar: false,
      updatedAt: null,
    });

    renderSuscripcion();

    expect(await screen.findByRole('region', { name: /suscripci[o\u00f3]n heredada/i })).toBeInTheDocument();
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar pago con wompi/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /configurar pagos wompi/i })).not.toBeInTheDocument();
  });
});
