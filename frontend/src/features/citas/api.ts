import { apiClient } from '../../lib/apiClient';

export type EstadoCita =
  | 'programada'
  | 'en_atencion'
  | 'realizada'
  | 'cancelada'
  | 'no_asistio';

export interface Cita {
  id: string;
  titulo: string;
  fecha: string;
  estado: EstadoCita;
  pacienteId?: string;
  pacienteNombre?: string;
  propietarioNombre?: string;
  propietarioTelefono?: string;
  motivo?: string;
  consultaId?: string;
  historiaClinicaId?: string;
  notas?: string;
}

export const listarCitas = async (): Promise<Cita[]> => {
  const res = await apiClient.get<Cita[]>('/v1/citas');
  return res.data ?? [];
};

export const listarCitasProximas2h = async (): Promise<Cita[]> => {
  const res = await apiClient.get<Cita[]>('/v1/citas/proximas-2h');
  return res.data ?? [];
};

export const crearCita = async (input: {
  motivo: string;
  fecha: string;
  pacienteId: string;
  notas?: string;
}): Promise<Cita> => {
  const res = await apiClient.post<Cita>('/v1/citas', input);
  return res.data;
};

export const cambiarEstadoCita = async (id: string, estado: EstadoCita): Promise<Cita> => {
  const res = await apiClient.patch<Cita>(`/v1/citas/${id}/estado`, { estado });
  return res.data;
};

export const vincularPacienteCita = async (id: string, pacienteId: string): Promise<Cita> => {
  const res = await apiClient.patch<Cita>(`/v1/citas/${id}/vincular-paciente`, { pacienteId });
  return res.data;
};

/** Etiqueta de paciente para listado (legacy incluido). */
export const etiquetaPacienteCita = (cita: Cita): string => {
  if (cita.pacienteNombre) return cita.pacienteNombre;
  if (cita.pacienteId) return 'Paciente vinculado';
  return 'Paciente no vinculado';
};

export const motivoCita = (cita: Cita): string => cita.motivo ?? cita.titulo;

/** Sugiere paciente por coincidencia exacta de nombre (case-insensitive) en titulo legacy. */
export const sugerirPacientePorTitulo = <T extends { id?: string; nombre: string }>(
  titulo: string,
  pacientes: T[],
): T | undefined => {
  const norm = titulo.trim().toLowerCase();
  if (!norm) return undefined;
  return pacientes.find((p) => p.nombre.trim().toLowerCase() === norm);
};
