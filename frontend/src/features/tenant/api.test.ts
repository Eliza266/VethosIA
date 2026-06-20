import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import { apiClient } from '../../lib/apiClient';
import {
  aceptarInvitacion,
  actualizarMe,
  aprobarSolicitudTecnica,
  crearInvitacionEntidadFreelance,
  crearInvitacionEntidadSede,
  listarSolicitudesTecnicas,
  obtenerMe,
  rechazarSolicitudTecnica,
} from './api';

describe('tenant/api me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtenerMe llama GET /v1/me', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        uid: 'u1',
        email: 'a@b.com',
        orgId: 'orgA',
        rol: 'vet',
        nombre: 'Vet',
        foto: null,
        telefono: '+57 1',
        whatsapp: null,
        ciudad: null,
        sede: null,
        veterinaria: null,
        matriculaProfesional: null,
        organizacionNombre: null,
      },
    });
    const me = await obtenerMe();
    expect(apiClient.get).toHaveBeenCalledWith('/v1/me');
    expect(me.uid).toBe('u1');
  });

  it('actualizarMe llama PATCH /v1/me', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: { uid: 'u1', telefono: '999' },
    });
    await actualizarMe({ telefono: '999' });
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/me', { telefono: '999' });
  });

  it('aceptarInvitacion soporta estado pendiente de revision tecnica', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        estado: 'pendiente_revision_tecnica',
        solicitudTecnicaId: 'sol1',
        mensaje: 'Revision pendiente.',
        orgId: 'orgA',
        rol: 'vet',
      },
    });
    const res = await aceptarInvitacion('tok');
    expect(apiClient.post).toHaveBeenCalledWith('/v1/invitaciones/aceptar', { token: 'tok' });
    expect('estado' in res ? res.estado : null).toBe('pendiente_revision_tecnica');
  });

  it('crea invitaciones V2 de Admin Entidad para sede y freelance', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { token: 'tok', expiraEn: '2026-06-19T00:00:00.000Z' } });

    await crearInvitacionEntidadSede({
      email: 'vet@sede.test',
      veterinariaId: 'vetclin_1',
      orgId: 'orgA',
      entidadId: 'ent_1',
      planOwnerId: 'ent_1',
    });
    expect(apiClient.post).toHaveBeenCalledWith('/v1/invitaciones/v2', {
      email: 'vet@sede.test',
      role: 'veterinario',
      accountType: 'veterinaria',
      accountId: 'vetclin_1',
      veterinariaId: 'vetclin_1',
      orgId: 'orgA',
      entidadId: 'ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      vinculoTipo: 'staff',
    });

    await crearInvitacionEntidadFreelance({
      email: 'free@entidad.test',
      orgId: 'orgA',
      entidadId: 'ent_1',
    });
    expect(apiClient.post).toHaveBeenCalledWith('/v1/invitaciones/v2', {
      email: 'free@entidad.test',
      role: 'veterinario',
      accountType: 'entidad',
      accountId: 'ent_1',
      orgId: 'orgA',
      entidadId: 'ent_1',
      planOwnerType: 'entidad',
      planOwnerId: 'ent_1',
      vinculoTipo: 'freelance',
    });
  });

  it('solicitudes tecnicas lista y resuelve por /v1', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [{ id: 'sol1', estado: 'pendiente' }] });
    await listarSolicitudesTecnicas('pendiente');
    expect(apiClient.get).toHaveBeenCalledWith('/v1/solicitudes-tecnicas', {
      params: { estado: 'pendiente' },
    });

    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: 'sol1', estado: 'aprobada' } });
    await aprobarSolicitudTecnica('sol1', 'ok');
    expect(apiClient.post).toHaveBeenCalledWith('/v1/solicitudes-tecnicas/sol1/aprobar', {
      decisionTecnica: 'ok',
    });
    await rechazarSolicitudTecnica('sol1', 'no');
    expect(apiClient.post).toHaveBeenCalledWith('/v1/solicitudes-tecnicas/sol1/rechazar', {
      decisionTecnica: 'no',
    });
  });
});
