import { apiClient } from '../../lib/apiClient';

export type EstadoVacuna = 'al_dia' | 'proxima_a_vencer' | 'proxima' | 'vencida';
export type FuenteVacuna = 'catalogo_base' | 'personalizada';

export interface Vacuna {
  id: string;
  pacienteId: string;
  nombre: string;
  especie?: string;
  catalogoCodigo?: string;
  intervaloDias?: number;
  fuente?: FuenteVacuna;
  aplicada?: string;
  aplicaciones?: string[];
  proximaDosis?: string;
  notas?: string;
  estado?: EstadoVacuna;
}

export interface VacunaCatalogoItem {
  codigo: string;
  especie: string;
  nombre: string;
  intervaloDias?: number;
  descripcion: string;
}

export interface VacunasPendientesResumen {
  proximas: number;
  vencidas: number;
}

export interface FiltrosVacunas {
  pacienteId?: string;
  especie?: string;
  estado?: EstadoVacuna;
  proximas?: boolean;
  vencidas?: boolean;
  tipo?: string;
}

const basePath = (pacienteId: string) => `/v1/pacientes/${pacienteId}/vacunas`;

const queryParams = (filtros: FiltrosVacunas): Record<string, string> => {
  const params: Record<string, string> = {};
  if (filtros.pacienteId) params.pacienteId = filtros.pacienteId;
  if (filtros.especie) params.especie = filtros.especie;
  if (filtros.estado) params.estado = filtros.estado;
  if (filtros.proximas) params.proximas = 'true';
  if (filtros.vencidas) params.vencidas = 'true';
  if (filtros.tipo) params.tipo = filtros.tipo;
  return params;
};

export const listarVacunasPaciente = async (pacienteId: string): Promise<Vacuna[]> => {
  const res = await apiClient.get<Vacuna[]>(basePath(pacienteId));
  return res.data ?? [];
};

export const listarVacunas = async (filtros: FiltrosVacunas = {}): Promise<Vacuna[]> => {
  const res = await apiClient.get<Vacuna[]>('/v1/vacunas', { params: queryParams(filtros) });
  return res.data ?? [];
};

export const obtenerCatalogoVacunas = async (): Promise<VacunaCatalogoItem[]> => {
  const res = await apiClient.get<VacunaCatalogoItem[]>('/v1/vacunas/catalogo');
  return res.data ?? [];
};

export const crearVacuna = async (input: {
  pacienteId: string;
  nombre: string;
  especie?: string;
  catalogoCodigo?: string;
  intervaloDias?: number;
  fuente?: FuenteVacuna;
  aplicada?: string;
  proximaDosis?: string;
  notas?: string;
}): Promise<Vacuna> => {
  const { pacienteId, ...body } = input;
  const res = await apiClient.post<Vacuna>(basePath(pacienteId), body);
  return res.data;
};

export const actualizarVacuna = async (
  pacienteId: string,
  vacunaId: string,
  campos: Partial<
    Pick<
      Vacuna,
      | 'nombre'
      | 'especie'
      | 'catalogoCodigo'
      | 'intervaloDias'
      | 'fuente'
      | 'aplicada'
      | 'proximaDosis'
      | 'notas'
    >
  >,
): Promise<Vacuna> => {
  const res = await apiClient.patch<Vacuna>(`${basePath(pacienteId)}/${vacunaId}`, campos);
  return res.data;
};

export const marcarVacunaAplicada = async (
  pacienteId: string,
  vacunaId: string,
  input: { aplicada?: string; intervaloDias?: number; notas?: string } = {},
): Promise<Vacuna> => {
  const res = await apiClient.post<Vacuna>(`${basePath(pacienteId)}/${vacunaId}/aplicar`, input);
  return res.data;
};

export const eliminarVacuna = async (
  pacienteId: string,
  vacunaId: string,
): Promise<void> => {
  await apiClient.delete(`${basePath(pacienteId)}/${vacunaId}`);
};

export const resumenVacunasPendientes = async (): Promise<VacunasPendientesResumen> => {
  const res = await apiClient.get<VacunasPendientesResumen>('/v1/vacunas/pendientes');
  return { proximas: res.data?.proximas ?? 0, vencidas: res.data?.vencidas ?? 0 };
};

export const vacunasPendientes = async (): Promise<number> => {
  return (await resumenVacunasPendientes()).proximas;
};

export const etiquetaEstadoVacuna = (estado?: EstadoVacuna): string => {
  switch (estado) {
    case 'proxima':
    case 'proxima_a_vencer':
      return 'Próxima';
    case 'vencida':
      return 'Vencida';
    case 'al_dia':
    default:
      return 'Al día';
  }
};

export const fechaVacuna = (v: Vacuna): string | undefined => v.aplicada ?? v.proximaDosis;

export const toDateInput = (iso?: string): string => (iso ? iso.slice(0, 10) : '');
