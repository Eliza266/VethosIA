import { apiClient } from '../../lib/apiClient';

export type PerfilRol =
  | 'superadmin'
  | 'admin'
  | 'admin_entidad'
  | 'admin_veterinaria'
  | 'vet'
  | 'veterinario'
  | 'asistente';
export type PerfilRolV2 = 'superadmin' | 'admin_entidad' | 'admin_veterinaria' | 'veterinario';

export type MiembroRol = 'admin' | 'vet';
export type MiembroRolLegacy = MiembroRol | 'asistente';

export interface Miembro {
  uid: string;
  rol: MiembroRolLegacy;
  bloqueado: boolean;
}

export type EstadoSolicitudTecnica = 'pendiente' | 'aprobada' | 'rechazada' | 'resuelta';

export interface SolicitudTecnica {
  id: string;
  tipo: 'vinculacion_veterinario';
  estado: EstadoSolicitudTecnica;
  emailInvitado: string;
  uidExistente?: string;
  orgSolicitante: string;
  orgActual?: string;
  rolSolicitado: MiembroRol;
  roleSolicitado?: PerfilRolV2;
  motivo?: string;
  conflicto?: string;
  decisionTecnica?: string;
  creadoPor: string;
  resueltoPor?: string;
  invitacionId?: string;
  creadoEn?: unknown;
  actualizadoEn?: unknown;
  resueltoEn?: unknown;
}

export type AceptarInvitacionResponse =
  | { orgId: string; rol: string; role?: PerfilRolV2 }
  | {
      estado: 'pendiente_revision_tecnica';
      solicitudTecnicaId: string;
      mensaje: string;
      orgId: string;
      rol: string;
      role?: PerfilRolV2;
    };

export interface MeProfile {
  uid: string;
  email: string | null;
  orgId: string | null;
  rol: PerfilRol | null;
  role?: PerfilRolV2 | null;
  accountId?: string | null;
  accountType?: 'vet_individual' | 'veterinaria' | 'entidad' | null;
  entidadId?: string | null;
  veterinariaId?: string | null;
  membershipId?: string | null;
  planOwnerType?: 'vet' | 'veterinaria' | 'entidad' | null;
  planOwnerId?: string | null;
  vinculoTipo?: 'staff' | 'freelance' | 'owner' | null;
  nombre: string | null;
  foto: string | null;
  telefono: string | null;
  whatsapp: string | null;
  ciudad: string | null;
  sede: string | null;
  veterinaria: string | null;
  matriculaProfesional: string | null;
  organizacionNombre: string | null;
}

export interface ActualizarPerfilInput {
  telefono?: string;
  whatsapp?: string;
  ciudad?: string;
  sede?: string;
  veterinaria?: string;
  matriculaProfesional?: string;
}

export const crearInvitacion = async (
  orgId: string,
  email: string,
  rol: MiembroRol,
): Promise<{ token: string; expiraEn: string }> => {
  const res = await apiClient.post<{ token: string; expiraEn: string }>('/v1/invitaciones', {
    orgId,
    email,
    rol,
  });
  return res.data;
};

export interface CrearInvitacionVeterinariaInput {
  email: string;
  veterinariaId: string;
  orgId?: string | null;
  entidadId?: string | null;
  planOwnerType?: 'veterinaria' | 'entidad' | null;
  planOwnerId?: string | null;
}

export const crearInvitacionVeterinaria = async (
  input: CrearInvitacionVeterinariaInput,
): Promise<{ token: string; expiraEn: string }> => {
  const res = await apiClient.post<{ token: string; expiraEn: string }>('/v1/invitaciones/v2', {
    email: input.email,
    role: 'veterinario',
    accountType: 'veterinaria',
    accountId: input.veterinariaId,
    veterinariaId: input.veterinariaId,
    orgId: input.orgId ?? undefined,
    entidadId: input.entidadId ?? undefined,
    planOwnerType: input.planOwnerType ?? 'veterinaria',
    planOwnerId: input.planOwnerId ?? input.veterinariaId,
    vinculoTipo: 'staff',
  });
  return res.data;
};

export interface CrearInvitacionEntidadSedeInput {
  email: string;
  veterinariaId: string;
  orgId?: string | null;
  entidadId: string;
  planOwnerId?: string | null;
}

export const crearInvitacionEntidadSede = async (
  input: CrearInvitacionEntidadSedeInput,
): Promise<{ token: string; expiraEn: string }> => {
  const res = await apiClient.post<{ token: string; expiraEn: string }>('/v1/invitaciones/v2', {
    email: input.email,
    role: 'veterinario',
    accountType: 'veterinaria',
    accountId: input.veterinariaId,
    veterinariaId: input.veterinariaId,
    orgId: input.orgId ?? undefined,
    entidadId: input.entidadId,
    planOwnerType: 'entidad',
    planOwnerId: input.planOwnerId ?? input.entidadId,
    vinculoTipo: 'staff',
  });
  return res.data;
};

export interface CrearInvitacionEntidadFreelanceInput {
  email: string;
  orgId?: string | null;
  entidadId: string;
}

export const crearInvitacionEntidadFreelance = async (
  input: CrearInvitacionEntidadFreelanceInput,
): Promise<{ token: string; expiraEn: string }> => {
  const res = await apiClient.post<{ token: string; expiraEn: string }>('/v1/invitaciones/v2', {
    email: input.email,
    role: 'veterinario',
    accountType: 'entidad',
    accountId: input.entidadId,
    orgId: input.orgId ?? undefined,
    entidadId: input.entidadId,
    planOwnerType: 'entidad',
    planOwnerId: input.entidadId,
    vinculoTipo: 'freelance',
  });
  return res.data;
};

export const aceptarInvitacion = async (token: string): Promise<AceptarInvitacionResponse> => {
  const res = await apiClient.post<AceptarInvitacionResponse>('/v1/invitaciones/aceptar', {
    token,
  });
  return res.data;
};

export const listarSolicitudesTecnicas = async (
  estado?: EstadoSolicitudTecnica,
): Promise<SolicitudTecnica[]> => {
  const res = estado
    ? await apiClient.get<SolicitudTecnica[]>('/v1/solicitudes-tecnicas', { params: { estado } })
    : await apiClient.get<SolicitudTecnica[]>('/v1/solicitudes-tecnicas');
  return res.data ?? [];
};

export const aprobarSolicitudTecnica = async (
  id: string,
  decisionTecnica?: string,
): Promise<SolicitudTecnica> => {
  const res = await apiClient.post<SolicitudTecnica>(`/v1/solicitudes-tecnicas/${id}/aprobar`, {
    decisionTecnica,
  });
  return res.data;
};

export const rechazarSolicitudTecnica = async (
  id: string,
  decisionTecnica?: string,
): Promise<SolicitudTecnica> => {
  const res = await apiClient.post<SolicitudTecnica>(`/v1/solicitudes-tecnicas/${id}/rechazar`, {
    decisionTecnica,
  });
  return res.data;
};

export const resolverSolicitudTecnica = async (
  id: string,
  decisionTecnica?: string,
): Promise<SolicitudTecnica> => {
  const res = await apiClient.post<SolicitudTecnica>(`/v1/solicitudes-tecnicas/${id}/resolver`, {
    decisionTecnica,
  });
  return res.data;
};

export const listarMiembros = async (orgId: string): Promise<Miembro[]> => {
  const res = await apiClient.get<Miembro[]>(`/v1/organizaciones/${orgId}/miembros`);
  return res.data ?? [];
};

export const setBloqueoMiembro = async (
  orgId: string,
  uid: string,
  bloqueado: boolean,
): Promise<void> => {
  await apiClient.patch(`/v1/organizaciones/${orgId}/miembros/${uid}/bloqueo`, { bloqueado });
};

export const obtenerMe = async (): Promise<MeProfile> => {
  const res = await apiClient.get<MeProfile>('/v1/me');
  return res.data;
};

export const actualizarMe = async (input: ActualizarPerfilInput): Promise<MeProfile> => {
  const res = await apiClient.patch<MeProfile>('/v1/me', input);
  return res.data;
};
