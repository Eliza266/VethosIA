import { apiClient } from '../../lib/apiClient';

export interface Metricas {
  alcance: 'global' | 'entidad' | 'veterinaria' | 'individual';
  periodo?: { desde?: string; hasta?: string; consumo: string };
  pacientes: number;
  pacientesAtendidos?: number;
  consultas: number;
  consultasAprobadas?: number;
  soapGenerados?: number;
  soapUsados?: number;
  soapLimite?: number;
  soapRestante?: number;
  soapPorcentaje?: number;
  tiempoAhorradoMinutos?: number;
  citas: number;
  citasProgramadas?: number;
  citasRealizadas?: number;
  citasNoAsistio?: number;
  citasCanceladas?: number;
  vacunas: number;
  vacunasAlDia?: number;
  vacunasProximas: number;
  vacunasVencidas: number;
  cumplimientoVacunacion: number;
  brigadas?: number;
  brigadasPlanificadas?: number;
  brigadasEnCurso?: number;
  brigadasFinalizadas?: number;
  brigadasParticipantes?: number;
  topDiagnosticos: Array<{ nombre: string; total: number }>;
  distribucionEspecies?: Array<{ clave: string; total: number }>;
  consumoIaPorVeterinario?: Array<{
    veterinarioId: string;
    usados: number;
    limite: number;
    porcentaje: number;
    bloqueado: boolean;
  }>;
  consolidadoVeterinarias?: Array<{
    veterinariaId: string;
    pacientes: number;
    consultas: number;
    soapGenerados: number;
    vacunasVencidas: number;
    citasProgramadas: number;
  }>;
  pacientesPorMes?: Array<{ mes: string; total: number }>;
  consultasPorMes?: Array<{ mes: string; total: number }>;
  consultasPorVeterinario?: Array<{ veterinarioId: string; total: number }>;
}

export const obtenerMetricas = async (params?: {
  desde?: string;
  hasta?: string;
  veterinarioId?: string;
  veterinariaId?: string;
}): Promise<Metricas> => {
  const res = await apiClient.get<Metricas>('/v1/metricas', { params });
  return res.data;
};

export interface ConsumoActual {
  periodo: string;
  usados: number;
  limite: number;
  restante: number;
  porcentaje: number;
  alcanzo80: boolean;
  bloqueado: boolean;
}

export const obtenerConsumo = async (): Promise<ConsumoActual> => {
  const res = await apiClient.get<ConsumoActual>('/v1/consumo');
  return res.data;
};
