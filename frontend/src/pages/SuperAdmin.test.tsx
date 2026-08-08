import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { UIProviders } from '../components/ui/Primitives';
import SuperAdmin from './SuperAdmin';
import Navbar from '../components/Navbar';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    firebaseUser: { uid: 'super1' },
    logout: vi.fn(),
  }),
}));

const {
  mockUseMe,
  mockListarPlanes,
  mockCrearPlan,
  mockListarPagos,
  mockListarSolicitudesTecnicas,
  mockAprobarSolicitudTecnica,
  mockRechazarSolicitudTecnica,
  mockListarEntidadesBackoffice,
  mockCrearEntidadBackoffice,
  mockActualizarEntidadGlobalBackoffice,
  mockListarVeterinariasBackoffice,
  mockCrearVeterinariaBackoffice,
  mockActualizarVeterinariaBackoffice,
  mockListarMiembrosBackoffice,
  mockSetBloqueoMiembroBackoffice,
  mockListarConsumosBackoffice,
  mockListarSuscripcionesBackoffice,
  mockListarAuditoriaBackoffice,
  mockObtenerConfiguracionPlataforma,
} = vi.hoisted(() => ({
  mockUseMe: vi.fn(),
  mockListarPlanes: vi.fn(),
  mockCrearPlan: vi.fn(),
  mockListarPagos: vi.fn(),
  mockListarSolicitudesTecnicas: vi.fn(),
  mockAprobarSolicitudTecnica: vi.fn(),
  mockRechazarSolicitudTecnica: vi.fn(),
  mockListarEntidadesBackoffice: vi.fn(),
  mockCrearEntidadBackoffice: vi.fn(),
  mockActualizarEntidadGlobalBackoffice: vi.fn(),
  mockListarVeterinariasBackoffice: vi.fn(),
  mockCrearVeterinariaBackoffice: vi.fn(),
  mockActualizarVeterinariaBackoffice: vi.fn(),
  mockListarMiembrosBackoffice: vi.fn(),
  mockSetBloqueoMiembroBackoffice: vi.fn(),
  mockListarConsumosBackoffice: vi.fn(),
  mockListarSuscripcionesBackoffice: vi.fn(),
  mockListarAuditoriaBackoffice: vi.fn(),
  mockObtenerConfiguracionPlataforma: vi.fn(),
}));

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

vi.mock('../features/saas/api', () => ({
  listarPlanes: mockListarPlanes,
  crearPlan: mockCrearPlan,
  listarPagos: mockListarPagos,
}));

vi.mock('../features/plataforma/api', () => ({
  obtenerConfiguracionPlataforma: mockObtenerConfiguracionPlataforma,
}));

vi.mock('../features/tenant/api', () => ({
  listarSolicitudesTecnicas: mockListarSolicitudesTecnicas,
  aprobarSolicitudTecnica: mockAprobarSolicitudTecnica,
  rechazarSolicitudTecnica: mockRechazarSolicitudTecnica,
}));

vi.mock('../features/backoffice/api', () => ({
  listarEntidadesBackoffice: mockListarEntidadesBackoffice,
  crearEntidadBackoffice: mockCrearEntidadBackoffice,
  actualizarEntidadGlobalBackoffice: mockActualizarEntidadGlobalBackoffice,
  listarVeterinariasBackoffice: mockListarVeterinariasBackoffice,
  crearVeterinariaBackoffice: mockCrearVeterinariaBackoffice,
  actualizarVeterinariaBackoffice: mockActualizarVeterinariaBackoffice,
  listarMiembrosBackoffice: mockListarMiembrosBackoffice,
  setBloqueoMiembroBackoffice: mockSetBloqueoMiembroBackoffice,
  listarConsumosBackoffice: mockListarConsumosBackoffice,
  listarSuscripcionesBackoffice: mockListarSuscripcionesBackoffice,
  listarAuditoriaBackoffice: mockListarAuditoriaBackoffice,
}));

function renderSuperAdmin(initialEntry = '/admin') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <UIProviders>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Navbar />
          <SuperAdmin />
        </MemoryRouter>
      </UIProviders>
    </QueryClientProvider>,
  );
}

describe('SuperAdmin', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockUseMe.mockReturnValue({ data: { uid: 'super1', rol: 'superadmin', role: 'superadmin', membershipId: 'm_root' } });
    mockListarPlanes.mockResolvedValue([
      {
        id: 'plan_pro',
        nombre: 'Plan Pro',
        precioMensualCOP: 99000,
        precioAnualCOP: 990000,
        asientosMax: 5,
        limiteHistoriasMes: 80,
        historiasGratisTrial: 10,
        tipo: 'ambos',
        activo: true,
      },
    ]);
    mockCrearPlan.mockResolvedValue({ id: 'plan_new', nombre: 'Plan Nuevo' });
    mockListarPagos.mockResolvedValue([
      { id: 'pay1', transactionId: 'tx1', reference: 'sub1', status: 'APPROVED', amountInCents: 9900000, currency: 'COP' },
    ]);
    mockListarSolicitudesTecnicas.mockResolvedValue([
      {
        id: 'sol1',
        tipo: 'vinculacion_veterinario',
        estado: 'pendiente',
        emailInvitado: 'vet@x.com',
        orgSolicitante: 'orgA',
        rolSolicitado: 'vet',
        creadoPor: 'adminA',
        conflicto: 'El usuario ya pertenece a una organizacion.',
      },
    ]);
    mockAprobarSolicitudTecnica.mockResolvedValue({ id: 'sol1', estado: 'aprobada' });
    mockRechazarSolicitudTecnica.mockResolvedValue({ id: 'sol1', estado: 'rechazada' });
    mockListarEntidadesBackoffice.mockResolvedValue([
      { id: 'ent_1', nombre: 'Entidad Norte', tipo: 'cadena', ciudad: 'Bogota', pais: 'Colombia', estado: 'activa', emailContacto: 'contacto@entidad.test' },
    ]);
    mockCrearEntidadBackoffice.mockResolvedValue({ id: 'ent_2', nombre: 'Entidad Global', tipo: 'ong', estado: 'activa' });
    mockActualizarEntidadGlobalBackoffice.mockResolvedValue({ id: 'ent_1', nombre: 'Entidad Norte Editada', tipo: 'ong', ciudad: 'Medellin', estado: 'inactiva' });
    mockListarVeterinariasBackoffice.mockResolvedValue([
      {
        id: 'vetclin_1',
        nombre: 'Clinica Norte',
        ciudad: 'Bogota',
        estado: 'activa',
        entidadId: 'ent_1',
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
        accountType: 'veterinaria',
        accountId: 'vetclin_1',
      },
    ]);
    mockActualizarVeterinariaBackoffice.mockResolvedValue({
      id: 'vetclin_1',
      nombre: 'Clinica Norte 24h',
      ciudad: 'Cali',
      estado: 'inactiva',
      entidadId: 'ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
    });
    mockCrearVeterinariaBackoffice.mockResolvedValue({
      id: 'vetclin_2',
      nombre: 'Sede Global',
      ciudad: 'Cali',
      estado: 'activa',
      entidadId: 'ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      accountType: 'veterinaria',
      accountId: 'vetclin_2',
    });
    mockListarMiembrosBackoffice.mockResolvedValue([
      { id: 'm_root', uid: 'super1', email: 'root@vetia.test', rol: 'superadmin', role: 'superadmin', bloqueado: false },
      {
        id: 'm_vet1',
        uid: 'vet1',
        email: 'vet1@clinica.com',
        rol: 'vet',
        role: 'veterinario',
        accountType: 'veterinaria',
        accountId: 'vetclin_1',
        entidadId: 'ent_1',
        veterinariaId: 'vetclin_1',
        planOwnerId: 'ent_1',
        bloqueado: false,
      },
    ]);
    mockSetBloqueoMiembroBackoffice.mockResolvedValue({ id: 'm_vet1', uid: 'vet1', bloqueado: true });
    mockListarConsumosBackoffice.mockResolvedValue([
      { id: 'vet1_2026-06', scopeId: 'vet1', entidadId: 'ent_1', veterinariaId: 'vetclin_1', periodo: '2026-06', usados: 8, limite: 10, bloqueado: false },
    ]);
    mockListarSuscripcionesBackoffice.mockResolvedValue([
      { id: 'sub1', planOwnerType: 'entidad', planOwnerId: 'ent_1', planId: 'plan_pro', estado: 'activa', vigenteHasta: '2026-07-01' },
    ]);
    mockListarAuditoriaBackoffice.mockResolvedValue([
      { id: 'log1', accion: 'miembro.desactivar', actorUid: 'root', orgId: 'orgA', recurso: 'm_vet1' },
    ]);
    mockObtenerConfiguracionPlataforma.mockResolvedValue({
      defaults: {
        suscripcionDiasPorVencer: 5,
        suscripcionDiasGracia: 5,
        consumoAlertaPorcentaje: 80,
        sesionInactivaHoras: 8,
        citaProximaHoras: 2,
        citaDiaAnteriorHoras: 24,
        vacunasVentanaProximaDias: 30,
        invitacionTtlHoras: 48,
      },
      integrations: {
        email: { mode: 'disabled', realProviderConfigured: false, mockAllowed: true },
        whatsapp: { mode: 'safe_link_only', realApiEnabled: false },
        wompi: { mode: 'server_side_tenant_config', checkoutGlobalEnabled: false, globalSecretsPresent: false, baseUrl: 'https://sandbox.wompi.co/v1' },
        jobs: { queueDriver: 'inmemory', schedulerAutoRunEnabled: false, workerGuard: 'x-worker-secret', workerUrlConfigured: false },
      },
      notes: ['Vista read-only para Super Admin.'],
    });
  });

  it('muestra dashboard plataforma y permite aprobar solicitudes tecnicas pendientes', async () => {
    renderSuperAdmin('/admin');

    expect(await screen.findByTestId('superadmin-overview-panel')).toBeInTheDocument();
    expect(screen.getByText(/Operaci[oó]n plataforma/i)).toBeInTheDocument();
    expect(await screen.findByText('vet@x.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /aprobar vinculaci[o\u00f3]n/i }));

    await waitFor(() => {
      expect(mockAprobarSolicitudTecnica).toHaveBeenCalledWith('sol1', 'Vinculacion aprobada por Area Tecnica.');
    });
  });

  it('gestiona entidades globales con payload seguro', async () => {
    renderSuperAdmin('/admin?panel=entidades');

    expect(await screen.findByTestId('superadmin-entidades-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /crear nueva entidad/i }));
    fireEvent.change(screen.getByLabelText(/nombre entidad global/i), { target: { value: 'Entidad Global' } });
    fireEvent.change(screen.getByLabelText(/tipo entidad global/i), { target: { value: 'ong' } });
    fireEvent.change(screen.getByLabelText(/ciudad entidad global/i), { target: { value: 'Cali' } });
    fireEvent.change(screen.getByLabelText(/correo entidad global/i), { target: { value: 'global@entidad.test' } });
    fireEvent.click(screen.getByRole('button', { name: /^crear entidad$/i }));

    await waitFor(() => {
      expect(mockCrearEntidadBackoffice).toHaveBeenCalledWith(expect.objectContaining({
        nombre: 'Entidad Global',
        tipo: 'ong',
        ciudad: 'Cali',
        emailContacto: 'global@entidad.test',
        estado: 'activa',
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: /editar entidad entidad norte/i }));
    fireEvent.change(screen.getByLabelText(/nombre entidad entidad norte/i), { target: { value: 'Entidad Norte Editada' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar entidad entidad norte/i }));

    await waitFor(() => expect(mockActualizarEntidadGlobalBackoffice).toHaveBeenCalledWith('ent_1', expect.objectContaining({ nombre: 'Entidad Norte Editada' })));
  });

  it('gestiona sedes globales con entidad destino explicita', async () => {
    renderSuperAdmin('/admin?panel=veterinarias');

    expect(await screen.findByTestId('superadmin-veterinarias-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /crear nueva sede/i }));
    expect(await screen.findByRole('option', { name: 'Entidad Norte' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/entidad objetivo sede/i), { target: { value: 'ent_1' } });
    fireEvent.change(screen.getByLabelText(/nombre sede global/i), { target: { value: 'Sede Global' } });
    fireEvent.change(screen.getByLabelText(/ciudad sede global/i), { target: { value: 'Cali' } });
    fireEvent.click(screen.getByRole('button', { name: /^crear sede$/i }));

    await waitFor(() => {
      expect(mockCrearVeterinariaBackoffice).toHaveBeenCalledWith(expect.objectContaining({
        entidadId: 'ent_1',
        nombre: 'Sede Global',
        ciudad: 'Cali',
        planOwnerType: 'entidad',
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: /editar sede clinica norte/i }));
    fireEvent.change(screen.getByLabelText(/nombre sede clinica norte/i), { target: { value: 'Clinica Norte 24h' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar sede clinica norte/i }));

    await waitFor(() => expect(mockActualizarVeterinariaBackoffice).toHaveBeenCalledWith('vetclin_1', expect.objectContaining({ nombre: 'Clinica Norte 24h' })));
  });

  it('lista usuarios, bloquea con confirmacion y protege self-disable', async () => {
    renderSuperAdmin('/admin?panel=usuarios');

    expect(await screen.findByTestId('superadmin-usuarios-panel')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /cuenta actual sin accion/i })).toBeDisabled();
    fireEvent.click(await screen.findByRole('button', { name: /desactivar usuario vet1@clinica\.com/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^Desactivar$/i }));

    await waitFor(() => expect(mockSetBloqueoMiembroBackoffice).toHaveBeenCalledWith('m_vet1', true));
  });

  it('renderiza planes, suscripciones, pagos, auditoria y configuracion sin placeholders', async () => {
    renderSuperAdmin('/planes');
    expect(await screen.findByTestId('superadmin-planes-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /crear nuevo plan/i }));
    fireEvent.change(screen.getByLabelText(/nombre del plan/i), { target: { value: 'Plan Nuevo' } });
    fireEvent.click(screen.getByRole('button', { name: /^crear plan$/i }));
    await waitFor(() => expect(mockCrearPlan).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Plan Nuevo' })));

    cleanup();
    renderSuperAdmin('/suscripciones');
    expect(await screen.findByTestId('superadmin-suscripciones-panel')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Guardar Plan/i })).toBeInTheDocument();

    cleanup();
    renderSuperAdmin('/admin?panel=pagos');
    expect(await screen.findByTestId('superadmin-pagos-panel')).toBeInTheDocument();
    expect(screen.getAllByText(/checkout global/i).length).toBeGreaterThan(0);

    cleanup();
    renderSuperAdmin('/auditoria');
    expect(await screen.findByTestId('superadmin-auditoria-panel')).toBeInTheDocument();
    expect((await screen.findAllByText(/miembro\.desactivar/i)).length).toBeGreaterThan(0);

    cleanup();
    renderSuperAdmin('/configuracion');
    expect(await screen.findByTestId('superadmin-configuracion-panel')).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp/i)).toBeInTheDocument();
    expect(await screen.findByText(/safe_link_only/i)).toBeInTheDocument();
  });

  it('no expone enlaces tenant como panel principal de superadmin', async () => {
    renderSuperAdmin('/admin');

    expect((await screen.findAllByText('Super Admin')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /vista entidad/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^veterinarias$/i })).toHaveAttribute(
      'href',
      '/admin?panel=veterinarias',
    );
  });
});
