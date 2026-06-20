import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminEntidad from './AdminEntidad';

const {
  mockUseMe,
  mockCrearInvitacionEntidadSede,
  mockCrearInvitacionEntidadFreelance,
  mockListarSolicitudesTecnicas,
  mockObtenerEntidadBackoffice,
  mockActualizarEntidadBackoffice,
  mockCrearVeterinariaBackoffice,
  mockActualizarVeterinariaBackoffice,
  mockListarVeterinariasBackoffice,
  mockListarMiembrosBackoffice,
  mockListarConsumosBackoffice,
  mockSetBloqueoMiembroBackoffice,
} = vi.hoisted(() => ({
  mockUseMe: vi.fn(),
  mockCrearInvitacionEntidadSede: vi.fn(),
  mockCrearInvitacionEntidadFreelance: vi.fn(),
  mockListarSolicitudesTecnicas: vi.fn(),
  mockObtenerEntidadBackoffice: vi.fn(),
  mockActualizarEntidadBackoffice: vi.fn(),
  mockCrearVeterinariaBackoffice: vi.fn(),
  mockActualizarVeterinariaBackoffice: vi.fn(),
  mockListarVeterinariasBackoffice: vi.fn(),
  mockListarMiembrosBackoffice: vi.fn(),
  mockListarConsumosBackoffice: vi.fn(),
  mockSetBloqueoMiembroBackoffice: vi.fn(),
}));

vi.mock('../features/tenant/hooks', () => ({
  useMe: () => mockUseMe(),
}));

vi.mock('../features/tenant/api', () => ({
  crearInvitacionEntidadSede: mockCrearInvitacionEntidadSede,
  crearInvitacionEntidadFreelance: mockCrearInvitacionEntidadFreelance,
  listarSolicitudesTecnicas: mockListarSolicitudesTecnicas,
}));

vi.mock('../features/backoffice/api', () => ({
  obtenerEntidadBackoffice: mockObtenerEntidadBackoffice,
  actualizarEntidadBackoffice: mockActualizarEntidadBackoffice,
  crearVeterinariaBackoffice: mockCrearVeterinariaBackoffice,
  actualizarVeterinariaBackoffice: mockActualizarVeterinariaBackoffice,
  listarVeterinariasBackoffice: mockListarVeterinariasBackoffice,
  listarMiembrosBackoffice: mockListarMiembrosBackoffice,
  listarConsumosBackoffice: mockListarConsumosBackoffice,
  setBloqueoMiembroBackoffice: mockSetBloqueoMiembroBackoffice,
}));

vi.mock('../features/metricas/MetricsPanel', () => ({
  MetricsPanel: () => <section aria-label="Metricas entidad" />,
}));

vi.mock('../features/saas/BusinessOverview', () => ({
  BusinessOverview: () => <section aria-label="Resumen entidad" />,
}));

function renderAdminEntidad() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdminEntidad />
    </QueryClientProvider>,
  );
}

describe('AdminEntidad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMe.mockReturnValue({
      data: {
        uid: 'adminEnt',
        email: 'admin.entidad@x.com',
        rol: 'admin',
        role: 'admin_entidad',
        orgId: 'orgA',
        entidadId: 'ent_1',
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
      },
    });
    mockObtenerEntidadBackoffice.mockResolvedValue({
      id: 'ent_1',
      nombre: 'Entidad Norte',
      tipo: 'cadena',
      direccion: 'Avenida 1 #10-20',
      ciudad: 'Bogota',
      pais: 'Colombia',
      telefono: '+57 300 100 2000',
      emailContacto: 'contacto@entidadnorte.com',
      logoUrl: 'https://cdn.test/entidad.png',
      estado: 'activa',
      planOwnerId: 'ent_1',
    });
    mockActualizarEntidadBackoffice.mockResolvedValue({ id: 'ent_1', nombre: 'Entidad Norte Editada' });
    mockCrearVeterinariaBackoffice.mockResolvedValue({
      id: 'vetclin_2',
      nombre: 'Nueva sede',
      estado: 'activa',
    });
    mockActualizarVeterinariaBackoffice.mockResolvedValue({ id: 'vetclin_1', nombre: 'Clinica Norte Editada' });
    mockListarVeterinariasBackoffice.mockResolvedValue([
      {
        id: 'vetclin_1',
        nombre: 'Clinica Norte',
        ciudad: 'Bogota',
        estado: 'activa',
        planOwnerType: 'entidad',
        planOwnerId: 'ent_1',
        accountType: 'veterinaria',
        accountId: 'vetclin_1',
        entidadId: 'ent_1',
      },
    ]);
    mockListarMiembrosBackoffice.mockResolvedValue([
      {
        id: 'm_admin_ent',
        uid: 'adminEnt',
        email: 'admin.entidad@x.com',
        rol: 'admin',
        role: 'admin_entidad',
        accountType: 'entidad',
        accountId: 'ent_1',
        entidadId: 'ent_1',
        estado: 'activo',
        bloqueado: false,
      },
      {
        id: 'm_vet1',
        uid: 'vet1',
        email: 'vet1@clinica.com',
        rol: 'vet',
        role: 'veterinario',
        accountType: 'veterinaria',
        accountId: 'vetclin_1',
        veterinariaId: 'vetclin_1',
        entidadId: 'ent_1',
        estado: 'activo',
        bloqueado: false,
      },
      {
        id: 'm_free',
        uid: 'vetFree',
        email: 'free@entidad.com',
        rol: 'vet',
        role: 'veterinario',
        accountType: 'entidad',
        accountId: 'ent_1',
        entidadId: 'ent_1',
        vinculoTipo: 'freelance',
        estado: 'activo',
        bloqueado: false,
      },
    ]);
    mockListarConsumosBackoffice.mockResolvedValue([
      {
        id: 'ent_1_2026-06',
        scopeId: 'ent_1',
        entidadId: 'ent_1',
        periodo: '2026-06',
        usados: 12,
        limite: 30,
        bloqueado: false,
      },
      {
        id: 'vet1_2026-06',
        scopeId: 'vet1',
        entidadId: 'ent_1',
        veterinariaId: 'vetclin_1',
        veterinarioId: 'vet1',
        periodo: '2026-06',
        usados: 8,
        limite: 10,
        bloqueado: false,
      },
      {
        id: 'vetFree_2026-06',
        scopeId: 'vetFree',
        entidadId: 'ent_1',
        veterinarioId: 'vetFree',
        periodo: '2026-06',
        usados: 4,
        limite: 10,
        bloqueado: false,
      },
    ]);
    mockListarSolicitudesTecnicas.mockResolvedValue([
      {
        id: 'sol1',
        tipo: 'vinculacion_veterinario',
        estado: 'pendiente',
        emailInvitado: 'conflicto@vet.com',
        orgSolicitante: 'orgA',
        rolSolicitado: 'vet',
        creadoPor: 'adminEnt',
        conflicto: 'Usuario con organizacion activa.',
      },
    ]);
    mockCrearInvitacionEntidadSede.mockResolvedValue({ token: 'tok_sede', expiraEn: '2026-06-19T00:00:00.000Z' });
    mockCrearInvitacionEntidadFreelance.mockResolvedValue({
      token: 'tok_free',
      expiraEn: '2026-06-19T00:00:00.000Z',
    });
    mockSetBloqueoMiembroBackoffice.mockResolvedValue({ id: 'm_vet1', uid: 'vet1', bloqueado: true });
  });

  it('muestra sedes, veterinarios por sede, freelancers y consumo consolidado', async () => {
    const { container } = renderAdminEntidad();

    expect(await screen.findByDisplayValue('Entidad Norte')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Avenida 1 #10-20')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Clinica Norte')).toBeInTheDocument();
    expect(screen.getByText('1 veterinarios')).toBeInTheDocument();
    expect(screen.getAllByText(/vet1@clinica\.com/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/free@entidad\.com/).length).toBeGreaterThan(0);
    expect(screen.getByText('Consolidado entidad')).toBeInTheDocument();
    expect(screen.getAllByText('12/30').length).toBeGreaterThan(0);
    expect(screen.getByText('conflicto@vet.com')).toBeInTheDocument();
    expect(container.querySelector('a[href="/veterinaria"]')).toBeNull();
  });

  it('guarda perfil completo de entidad', async () => {
    renderAdminEntidad();

    fireEvent.change(await screen.findByLabelText('Nombre de la entidad'), {
      target: { value: 'Entidad Norte Editada' },
    });
    fireEvent.change(screen.getByLabelText('Tipo de entidad'), { target: { value: 'gobierno' } });
    fireEvent.change(screen.getByLabelText('Correo de contacto'), {
      target: { value: 'operaciones@entidadnorte.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar entidad/i }));

    await waitFor(() => {
      expect(mockActualizarEntidadBackoffice).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Entidad Norte Editada',
          tipo: 'gobierno',
          direccion: 'Avenida 1 #10-20',
          ciudad: 'Bogota',
          pais: 'Colombia',
          telefono: '+57 300 100 2000',
          emailContacto: 'operaciones@entidadnorte.com',
          logoUrl: 'https://cdn.test/entidad.png',
        }),
      );
    });
  });

  it('crea y edita sedes con payload seguro', async () => {
    renderAdminEntidad();

    fireEvent.change(await screen.findByLabelText('Nombre de nueva sede'), {
      target: { value: 'Clinica Centro' },
    });
    fireEvent.change(screen.getByLabelText('Ciudad de nueva sede'), {
      target: { value: 'Cali' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear sede/i }));

    await waitFor(() => {
      expect(mockCrearVeterinariaBackoffice).toHaveBeenCalledWith({
        nombre: 'Clinica Centro',
        ciudad: 'Cali',
        planOwnerType: 'entidad',
      });
    });

    fireEvent.change(screen.getByLabelText('Nombre de sede Clinica Norte'), {
      target: { value: 'Clinica Norte 24h' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar sede clinica norte/i }));

    await waitFor(() => {
      expect(mockActualizarVeterinariaBackoffice).toHaveBeenCalledWith(
        'vetclin_1',
        expect.objectContaining({ nombre: 'Clinica Norte 24h', ciudad: 'Bogota', estado: 'activa' }),
      );
    });
  });

  it('genera invitaciones V2 para sede y freelance directo', async () => {
    renderAdminEntidad();

    fireEvent.change(await screen.findByLabelText('Email veterinario para Clinica Norte'), {
      target: { value: 'nuevo@clinica.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /invitar a sede/i }));

    await waitFor(() => {
      expect(mockCrearInvitacionEntidadSede).toHaveBeenCalledWith({
        email: 'nuevo@clinica.com',
        veterinariaId: 'vetclin_1',
        orgId: 'orgA',
        entidadId: 'ent_1',
        planOwnerId: 'ent_1',
      });
    });
    expect(await screen.findByText(/tok_sede/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email freelance'), {
      target: { value: 'free.nuevo@entidad.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /invitar freelance/i }));

    await waitFor(() => {
      expect(mockCrearInvitacionEntidadFreelance).toHaveBeenCalledWith({
        email: 'free.nuevo@entidad.com',
        orgId: 'orgA',
        entidadId: 'ent_1',
      });
    });
  });

  it('mantiene bloqueado el self-disable en UI', async () => {
    renderAdminEntidad();

    const adminRow = await screen.findByText(/admin\.entidad@x\.com/);
    const selfAction = within(adminRow.closest('li') as HTMLElement).getByRole('button', { name: /tu cuenta/i });
    expect(selfAction).toBeDisabled();
    fireEvent.click(selfAction);
    expect(mockSetBloqueoMiembroBackoffice).not.toHaveBeenCalled();
  });
});
