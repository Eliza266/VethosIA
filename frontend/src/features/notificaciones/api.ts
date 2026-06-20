import { apiClient } from '../../lib/apiClient';

export interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  leida: boolean;
  orgId?: string | null;
  entidadId?: string | null;
  veterinariaId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  resourcePath?: string | null;
  pacienteId?: string | null;
  consultaId?: string | null;
  creadoEn?: unknown;
}

export const listarNotificaciones = async (soloNoLeidas = false): Promise<Notificacion[]> => {
  const res = await apiClient.get<Notificacion[]>('/v1/notificaciones', {
    params: soloNoLeidas ? { noLeidas: 'true' } : undefined,
  });
  return res.data ?? [];
};

export const marcarNotificacionLeida = async (id: string): Promise<void> => {
  await apiClient.post(`/v1/notificaciones/${id}/leer`);
};

export const marcarTodasNotificacionesLeidas = async (): Promise<{ actualizadas: number }> => {
  const res = await apiClient.post<{ ok: true; actualizadas: number }>('/v1/notificaciones/leer-todas');
  return { actualizadas: res.data?.actualizadas ?? 0 };
};
