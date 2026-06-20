import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../../lib/apiClient', () => ({ apiClient: api }));

import {
  actualizarEntidadBackoffice,
  actualizarEntidadGlobalBackoffice,
  actualizarVeterinariaBackoffice,
  crearEntidadBackoffice,
  crearVeterinariaBackoffice,
  listarConsumosBackoffice,
  listarAuditoriaBackoffice,
  listarEntidadesBackoffice,
  listarMiembrosBackoffice,
  listarSuscripcionesBackoffice,
  listarVeterinariasBackoffice,
  listarVeterinariosBackoffice,
  obtenerEntidadBackoffice,
  obtenerPermisosBackoffice,
  obtenerVeterinariaBackoffice,
  setBloqueoMiembroBackoffice,
} from './api';

describe('backoffice/api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: [] });
    api.post.mockResolvedValue({ data: {} });
    api.patch.mockResolvedValue({ data: {} });
  });

  it('usa endpoints /v1/backoffice para lecturas por rol', async () => {
    await obtenerPermisosBackoffice();
    await listarEntidadesBackoffice();
    await obtenerEntidadBackoffice();
    await listarVeterinariasBackoffice();
    await obtenerVeterinariaBackoffice();
    await listarMiembrosBackoffice();
    await listarVeterinariosBackoffice();
    await listarConsumosBackoffice();
    await listarSuscripcionesBackoffice();
    await listarAuditoriaBackoffice();

    expect(api.get).toHaveBeenCalledWith('/v1/backoffice/permisos');
    expect(api.get).toHaveBeenCalledWith('/v1/backoffice/entidades');
    expect(api.get).toHaveBeenCalledWith('/v1/backoffice/entidad');
    expect(api.get).toHaveBeenCalledWith('/v1/backoffice/veterinarias');
    expect(api.get).toHaveBeenCalledWith('/v1/backoffice/veterinaria');
    expect(api.get).toHaveBeenCalledWith('/v1/backoffice/miembros');
    expect(api.get).toHaveBeenCalledWith('/v1/backoffice/veterinarios');
    expect(api.get).toHaveBeenCalledWith('/v1/backoffice/consumos');
    expect(api.get).toHaveBeenCalledWith('/v1/backoffice/suscripciones');
    expect(api.get).toHaveBeenCalledWith('/v1/backoffice/auditoria');
  });

  it('usa endpoints /v1/backoffice para mutaciones administrativas', async () => {
    await actualizarEntidadBackoffice({
      nombre: 'Entidad',
      tipo: 'cadena',
      emailContacto: 'contacto@entidad.test',
    });
    await crearEntidadBackoffice({
      nombre: 'Entidad Global',
      tipo: 'ong',
      emailContacto: 'global@entidad.test',
    });
    await actualizarEntidadGlobalBackoffice('ent_1', {
      nombre: 'Entidad Global Editada',
      estado: 'inactiva',
    });
    await crearVeterinariaBackoffice({
      nombre: 'Clinica',
      entidadId: 'ent_1',
      ciudad: 'Bogota',
      planOwnerType: 'entidad',
    });
    await actualizarVeterinariaBackoffice('vetclin_1', { estado: 'inactiva' });
    await setBloqueoMiembroBackoffice('m_vet1', true);

    expect(api.patch).toHaveBeenCalledWith('/v1/backoffice/entidad', {
      nombre: 'Entidad',
      tipo: 'cadena',
      emailContacto: 'contacto@entidad.test',
    });
    expect(api.post).toHaveBeenCalledWith('/v1/backoffice/entidades', {
      nombre: 'Entidad Global',
      tipo: 'ong',
      emailContacto: 'global@entidad.test',
    });
    expect(api.patch).toHaveBeenCalledWith('/v1/backoffice/entidades/ent_1', {
      nombre: 'Entidad Global Editada',
      estado: 'inactiva',
    });
    expect(api.post).toHaveBeenCalledWith('/v1/backoffice/veterinarias', {
      nombre: 'Clinica',
      entidadId: 'ent_1',
      ciudad: 'Bogota',
      planOwnerType: 'entidad',
    });
    expect(api.patch).toHaveBeenCalledWith('/v1/backoffice/veterinarias/vetclin_1', {
      estado: 'inactiva',
    });
    expect(api.patch).toHaveBeenCalledWith('/v1/backoffice/miembros/m_vet1/bloqueo', {
      bloqueado: true,
    });
  });
});
