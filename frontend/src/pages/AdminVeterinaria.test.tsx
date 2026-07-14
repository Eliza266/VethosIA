import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminVeterinaria from './AdminVeterinaria';

const {
  mockUseMe,
  mockCrearInvitacionVeterinaria,
  mockListarSolicitudesTecnicas,
  mockObtenerVeterinariaBackoffice,
  mockActualizarVeterinariaBackoffice,
  mockListarVeterinariosBackoffice,
  mockListarConsumosBackoffice,
  mockSetBloqueoMiembroBackoffice,
} = vi.hoisted(() => ({
  mockUseMe: vi.fn(),
  mockCrearInvitacionVeterinaria: vi.fn(),
  mockListarSolicitudesTecnicas: vi.fn(),
  mockObtenerVeterinariaBackoffice: vi.fn(),
  mockActualizarVeterinariaBackoffice: vi.fn(),
  mockListarVeterinariosBackoffice: vi.fn(),
  mockListarConsumosBackoffice: vi.fn(),
  mockSetBloqueoMiembroBackoffice: vi.fn(),
}));

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

vi.mock('../features/tenant/api', () => ({
  crearInvitacionVeterinaria: mockCrearInvitacionVeterinaria,
  listarSolicitudesTecnicas: mockListarSolicitudesTecnicas,
}));

vi.mock('../features/backoffice/api', () => ({
  obtenerVeterinariaBackoffice: mockObtenerVeterinariaBackoffice,
  actualizarVeterinariaBackoffice: mockActualizarVeterinariaBackoffice,
  listarVeterinariosBackoffice: mockListarVeterinariosBackoffice,
  listarConsumosBackoffice: mockListarConsumosBackoffice,
  setBloqueoMiembroBackoffice: mockSetBloqueoMiembroBackoffice,
}));

vi.mock('../features/metricas/MetricsPanel', () => ({
  MetricsPanel: () => <section aria-label="Metricas de clinica" />,
}));

vi.mock('../features/saas/BusinessOverview', () => ({
  BusinessOverview: () => <section aria-label="Resumen de negocio" />,
}));

function renderAdminVeterinaria(initialPath = '/veterinaria') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AdminVeterinaria />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminVeterinaria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMe.mockReturnValue({
      data: {
        uid: 'adminVet',
        email: 'admin.veterinaria@x.com',
        rol: 'admin',
        role: 'admin_veterinaria',
        orgId: 'orgA',
        veterinariaId: 'vetclin_1',
        entidadId: 'ent_1',
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
      },
    });
    mockCrearInvitacionVeterinaria.mockResolvedValue({
      token: 'tok_vet',
      expiraEn: '2026-06-19T00:00:00.000Z',
    });
    mockListarSolicitudesTecnicas.mockResolvedValue([]);
    mockObtenerVeterinariaBackoffice.mockResolvedValue({
      id: 'vetclin_1',
      nombre: 'Clinica Norte',
      direccion: 'Calle 1 #2-3',
      ciudad: 'Bogota',
      pais: 'Colombia',
      telefono: '+57 300 111 2233',
      emailContacto: 'contacto@clinicanorte.com',
      logoUrl: 'https://cdn.test/clinica-norte.png',
      estado: 'activa',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
    });
    mockActualizarVeterinariaBackoffice.mockResolvedValue({ id: 'vetclin_1', nombre: 'Clinica Norte' });
    mockListarVeterinariosBackoffice.mockResolvedValue([
      {
        id: 'm_vet1',
        uid: 'vet1',
        email: 'vet1@clinica.com',
        rol: 'vet',
        role: 'veterinario',
        veterinariaId: 'vetclin_1',
        estado: 'activo',
        bloqueado: false,
      },
    ]);
    mockListarConsumosBackoffice.mockResolvedValue([
      {
        id: 'vet_vet1_2026-06',
        scopeId: 'vet_vet1',
        veterinarioId: 'vet1',
        periodo: '2026-06',
        usados: 4,
        limite: 10,
        bloqueado: false,
      },
    ]);
    mockSetBloqueoMiembroBackoffice.mockResolvedValue({ id: 'm_vet1', uid: 'vet1', bloqueado: true });
  });

  it('muestra el hub de Configuración con sus tarjetas, sin Vista Entidad ni soporte', () => {
    renderAdminVeterinaria();

    expect(screen.getByText('Configuración')).toBeInTheDocument();
    expect(screen.getByText('Datos de la clínica')).toBeInTheDocument();
    expect(screen.getByText('Catálogo de vacunas')).toBeInTheDocument();
    expect(screen.getByText('Solicitudes técnicas y plan')).toBeInTheDocument();
    expect(screen.getAllByText(/Equipo cl[ií]nico/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Vista Entidad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Soporte Plataforma/i)).not.toBeInTheDocument();
  });

  it('invita veterinario usando el scope de su veterinaria', async () => {
    renderAdminVeterinaria('/veterinaria?tab=equipo');

    fireEvent.change(screen.getByLabelText('Email del veterinario'), {
      target: { value: 'nuevo@clinica.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /generar invitacion/i }));

    await waitFor(() => {
      expect(mockCrearInvitacionVeterinaria).toHaveBeenCalledWith({
        email: 'nuevo@clinica.com',
        veterinariaId: 'vetclin_1',
        orgId: 'orgA',
        entidadId: 'ent_1',
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
      });
    });
    expect(await screen.findByText(/tok_vet/)).toBeInTheDocument();
  });

  it('muestra los datos de la clinica en la pestaña ficha', async () => {
    renderAdminVeterinaria('/veterinaria?tab=ficha');

    expect(await screen.findByDisplayValue('Clinica Norte')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Calle 1 #2-3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bogota')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Colombia')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+57 300 111 2233')).toBeInTheDocument();
    expect(screen.getByDisplayValue('contacto@clinicanorte.com')).toBeInTheDocument();
    expect(screen.getByAltText('Logo de la clínica')).toHaveAttribute(
      'src',
      'https://cdn.test/clinica-norte.png',
    );
  });

  it('muestra miembros y consumo filtrados de la clinica en la pestaña equipo', async () => {
    renderAdminVeterinaria('/veterinaria?tab=equipo');

    expect(await screen.findByText(/vet1@clinica\.com/)).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText(/Consolidado cl[ií]nica/i)).toBeInTheDocument();
    expect(screen.getAllByText('4/10').length).toBeGreaterThan(0);
    expect(await screen.findByText(/vet1 - 2026-06/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /desactivar/i }));
    await waitFor(() => {
      expect(mockSetBloqueoMiembroBackoffice).toHaveBeenCalledWith('m_vet1', true);
    });
  });

  it('guarda el perfil completo de la veterinaria', async () => {
    renderAdminVeterinaria('/veterinaria?tab=ficha');

    await screen.findByDisplayValue('Clinica Norte');
    fireEvent.change(screen.getByLabelText('Nombre de la clinica'), {
      target: { value: 'Clinica Norte 24h' },
    });
    fireEvent.change(screen.getByLabelText('Ciudad'), {
      target: { value: 'Medellin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockActualizarVeterinariaBackoffice).toHaveBeenCalledWith('vetclin_1', {
        nombre: 'Clinica Norte 24h',
        direccion: 'Calle 1 #2-3',
        ciudad: 'Medellin',
        pais: 'Colombia',
        telefono: '+57 300 111 2233',
        emailContacto: 'contacto@clinicanorte.com',
        logoUrl: 'https://cdn.test/clinica-norte.png',
      });
    });
  });

  it('deshabilita bloqueo sobre el usuario actual', async () => {
    mockListarVeterinariosBackoffice.mockResolvedValue([
      {
        id: 'm_admin_vet',
        uid: 'adminVet',
        email: 'admin.veterinaria@x.com',
        rol: 'admin',
        role: 'admin_veterinaria',
        veterinariaId: 'vetclin_1',
        bloqueado: false,
      },
    ]);

    renderAdminVeterinaria('/veterinaria?tab=equipo');

    const selfAction = await screen.findByRole('button', { name: /tu cuenta/i });
    expect(selfAction).toBeDisabled();
    fireEvent.click(selfAction);
    expect(mockSetBloqueoMiembroBackoffice).not.toHaveBeenCalled();
  });
});
