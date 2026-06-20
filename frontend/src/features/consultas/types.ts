import type { SignosVitales, Consulta } from '../../types';

// Estado de edicion del borrador de consulta. Antes era `useState<any>` en
// DetalleConsulta (editData/signosVitales/perfilVet sin tipar). Lo tipamos.
export interface EditDataConsulta {
  motivo: string;
  prioridad: NonNullable<Consulta['prioridad']>;
  signosVitales: SignosVitales;
}

export const PRIORIDAD_COLORS: Record<string, string> = {
  urgente: 'bg-red-50 text-red-700 border-red-200',
  rutina: 'bg-green-50 text-green-700 border-green-200',
  seguimiento: 'bg-blue-50 text-blue-700 border-blue-200',
  brigada: 'bg-orange-50 text-orange-700 border-orange-200',
};

export const PRIORIDAD_LABELS: Record<string, string> = {
  urgente: 'Urgente',
  rutina: 'Rutina',
  seguimiento: 'Seguimiento',
  brigada: 'Brigada',
};

// Campos editables de signos vitales que muestra el form del borrador.
export const CAMPOS_SIGNOS_VITALES: { field: keyof SignosVitales; label: string; step: number }[] = [
  { field: 'peso', label: 'Peso (kg)', step: 0.1 },
  // talla agregado: antes faltaba y por eso paciente.ultimaTalla nunca se llenaba
  { field: 'talla', label: 'Talla (cm)', step: 0.1 },
  { field: 'temperatura', label: 'Temp (°C)', step: 0.1 },
  { field: 'frecuenciaCardiaca', label: 'FC (lpm)', step: 1 },
  { field: 'frecuenciaRespiratoria', label: 'FR (rpm)', step: 1 },
  { field: 'condicionCorporal', label: 'CC (1-5)', step: 1 },
];
