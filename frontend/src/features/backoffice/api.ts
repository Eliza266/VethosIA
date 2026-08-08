import { apiClient } from '../../lib/apiClient';

export type BackofficeRol = 'superadmin' | 'admin_entidad' | 'admin_veterinaria' | 'veterinario';

export interface BackofficePermisos {
  rol: BackofficeRol;
  alcance: 'global' | 'entidad' | 'veterinaria' | 'individual';
  puedeEditarEntidad: boolean;
  puedeGestionarVeterinarias: boolean;
  puedeGestionarMiembros: boolean;
  puedeResolverSolicitudesTecnicas: boolean;
  puedeVerAuditoriaGlobal: boolean;
}

export interface BackofficeEntidad {
  id: string;
  nombre: string;
  tipo?: 'gobierno' | 'cadena' | 'ong' | 'entidad' | null;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  logoUrl?: string | null;
  estado: 'activa' | 'inactiva';
  legacyOrgId?: string | null;
  planOwnerType?: 'entidad';
  planOwnerId?: string;
  creadoEn?: unknown;
  createdAt?: unknown;
}

export interface BackofficeVeterinaria {
  id: string;
  nombre: string;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  logoUrl?: string | null;
  orgId?: string | null;
  legacyOrgId?: string | null;
  entidadId?: string | null;
  planOwnerType: 'veterinaria' | 'entidad';
  planOwnerId: string;
  accountType: 'veterinaria';
  accountId: string;
  estado: 'activa' | 'inactiva';
  creadoEn?: unknown;
  createdAt?: unknown;
}

export interface BackofficeMiembro {
  id: string;
  uid: string;
  email?: string | null;
  orgId?: string;
  rol: 'superadmin' | 'admin' | 'vet' | 'asistente';
  role?: 'superadmin' | 'admin_entidad' | 'admin_veterinaria' | 'veterinario';
  accountType?: 'vet_individual' | 'veterinaria' | 'entidad';
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  membershipId?: string;
  planOwnerType?: 'vet' | 'veterinaria' | 'entidad';
  planOwnerId?: string;
  vinculoTipo?: 'staff' | 'freelance' | 'owner';
  estado?: 'activo' | 'inactivo' | 'bloqueado';
  bloqueado: boolean;
  creadoEn?: unknown;
  createdAt?: unknown;
}

export interface BackofficeConsumo {
  id: string;
  periodo?: string;
  scopeId?: string;
  orgId?: string | null;
  entidadId?: string | null;
  veterinariaId?: string | null;
  veterinarioId?: string | null;
  usados: number;
  limite?: number | null;
  porcentaje?: number | null;
  bloqueado: boolean;
}

export interface BackofficeAuditoria {
  id: string;
  accion?: string;
  actorUid?: string;
  orgId?: string | null;
  recurso?: string | null;
  timestamp?: unknown;
}

export type BackofficeEntidadInput = Partial<
  Pick<
    BackofficeEntidad,
    'nombre' | 'tipo' | 'direccion' | 'ciudad' | 'pais' | 'telefono' | 'emailContacto' | 'logoUrl' | 'estado'
  >
>;

export type CrearBackofficeEntidadInput = BackofficeEntidadInput & { nombre: string };

export const obtenerPermisosBackoffice = async (): Promise<BackofficePermisos> => {
  const res = await apiClient.get<BackofficePermisos>('/v1/backoffice/permisos');
  return res.data;
};

export const listarEntidadesBackoffice = async (): Promise<BackofficeEntidad[]> => {
  const res = await apiClient.get<BackofficeEntidad[]>('/v1/backoffice/entidades');
  return res.data ?? [];
};

export const crearEntidadBackoffice = async (input: CrearBackofficeEntidadInput): Promise<BackofficeEntidad> => {
  const res = await apiClient.post<BackofficeEntidad>('/v1/backoffice/entidades', input);
  return res.data;
};

export const actualizarEntidadGlobalBackoffice = async (
  id: string,
  input: BackofficeEntidadInput,
): Promise<BackofficeEntidad> => {
  const res = await apiClient.patch<BackofficeEntidad>(`/v1/backoffice/entidades/${id}`, input);
  return res.data;
};

export const obtenerEntidadBackoffice = async (): Promise<BackofficeEntidad | null> => {
  const res = await apiClient.get<BackofficeEntidad | null>('/v1/backoffice/entidad');
  return res.data ?? null;
};

export const actualizarEntidadBackoffice = async (
  input: Partial<
    Pick<
      BackofficeEntidad,
      'nombre' | 'tipo' | 'direccion' | 'ciudad' | 'pais' | 'telefono' | 'emailContacto' | 'logoUrl' | 'estado'
    >
  >,
): Promise<BackofficeEntidad | null> => {
  const res = await apiClient.patch<BackofficeEntidad | null>('/v1/backoffice/entidad', input);
  return res.data ?? null;
};

export const listarVeterinariasBackoffice = async (): Promise<BackofficeVeterinaria[]> => {
  const res = await apiClient.get<BackofficeVeterinaria[]>('/v1/backoffice/veterinarias');
  return res.data ?? [];
};

export const crearVeterinariaBackoffice = async (input: {
  nombre: string;
  entidadId?: string;
  direccion?: string | null;
  ciudad?: string | null;
  pais?: string | null;
  telefono?: string | null;
  emailContacto?: string | null;
  logoUrl?: string | null;
  planOwnerType?: 'veterinaria' | 'entidad';
}): Promise<BackofficeVeterinaria> => {
  const res = await apiClient.post<BackofficeVeterinaria>('/v1/backoffice/veterinarias', input);
  return res.data;
};

export const obtenerVeterinariaBackoffice = async (): Promise<BackofficeVeterinaria | null> => {
  const res = await apiClient.get<BackofficeVeterinaria | null>('/v1/backoffice/veterinaria');
  return res.data ?? null;
};

export const actualizarVeterinariaBackoffice = async (
  id: string,
  input: Partial<
    Pick<
      BackofficeVeterinaria,
      'nombre' | 'direccion' | 'ciudad' | 'pais' | 'telefono' | 'emailContacto' | 'logoUrl' | 'estado'
    >
  >,
): Promise<BackofficeVeterinaria> => {
  const res = await apiClient.patch<BackofficeVeterinaria>(`/v1/backoffice/veterinarias/${id}`, input);
  return res.data;
};

export const listarMiembrosBackoffice = async (): Promise<BackofficeMiembro[]> => {
  const res = await apiClient.get<BackofficeMiembro[]>('/v1/backoffice/miembros');
  return res.data ?? [];
};

export const listarVeterinariosBackoffice = async (): Promise<BackofficeMiembro[]> => {
  const res = await apiClient.get<BackofficeMiembro[]>('/v1/backoffice/veterinarios');
  return res.data ?? [];
};

export const crearVeterinarioCredencialesBackoffice = async (input: {
  nombre: string;
  email: string;
  password: string;
  veterinariaId?: string;
}): Promise<BackofficeMiembro> => {
  const res = await apiClient.post<BackofficeMiembro>('/v1/backoffice/veterinarios', input);
  return res.data;
};

export const setBloqueoMiembroBackoffice = async (
  id: string,
  bloqueado: boolean,
): Promise<{ id: string; uid: string; bloqueado: boolean }> => {
  const res = await apiClient.patch<{ id: string; uid: string; bloqueado: boolean }>(
    `/v1/backoffice/miembros/${id}/bloqueo`,
    { bloqueado },
  );
  return res.data;
};

export const listarConsumosBackoffice = async (): Promise<BackofficeConsumo[]> => {
  const res = await apiClient.get<BackofficeConsumo[]>('/v1/backoffice/consumos');
  return res.data ?? [];
};

export const listarSuscripcionesBackoffice = async (): Promise<Array<Record<string, unknown>>> => {
  const res = await apiClient.get<Array<Record<string, unknown>>>('/v1/backoffice/suscripciones');
  return res.data ?? [];
};

export const listarAuditoriaBackoffice = async (): Promise<BackofficeAuditoria[]> => {
  const res = await apiClient.get<BackofficeAuditoria[]>('/v1/backoffice/auditoria');
  return res.data ?? [];
};
