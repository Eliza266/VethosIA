import { z } from 'zod';

// Contratos compartidos del API /v1 (fuente de verdad del shape que el frontend espera).
// Si el backend cambia la forma, estos esquemas (y sus contract tests) lo detectan.

export const signosVitalesContract = z.object({
  peso: z.number().nullable().optional(),
  talla: z.number().optional(),
  temperatura: z.number().nullable().optional(),
  frecuenciaCardiaca: z.number().nullable().optional(),
  frecuenciaRespiratoria: z.number().nullable().optional(),
  condicionCorporal: z.number().nullable().optional(),
});

export const soapContract = z.object({
  motivo: z.string(),
  prioridad: z.enum(['urgente', 'rutina', 'seguimiento', 'brigada']),
  signosVitales: signosVitalesContract,
  subjetivo: z.string(),
  objetivo: z.string(),
  analisis: z.string(),
  plan: z.string(),
  medicamentosSugeridos: z.array(
    z.object({
      nombre: z.string(),
      dosis: z.string(),
      via: z.string(),
      frecuencia: z.string(),
      duracion: z.string(),
      indicacion: z.string(),
    }),
  ),
});

export const metricasContract = z.object({
  alcance: z.enum(['global', 'entidad', 'individual']),
  pacientes: z.number(),
  consultas: z.number(),
  citas: z.number(),
  vacunas: z.number(),
});

export const consumoContract = z.object({
  periodo: z.string(),
  usados: z.number(),
  limite: z.number(),
  restante: z.number(),
  porcentaje: z.number(),
  alcanzo80: z.boolean(),
  bloqueado: z.boolean(),
});

export const pacienteContract = z.object({
  id: z.string(),
  nombre: z.string(),
  codigo: z.string().optional(),
  orgId: z.string().optional(),
  veterinarioId: z.string().optional(),
  foto: z.string().optional(),
  deletedAt: z.union([z.string(), z.null()]).optional(),
});

export type SoapContract = z.infer<typeof soapContract>;
export type MetricasContract = z.infer<typeof metricasContract>;
export type ConsumoContract = z.infer<typeof consumoContract>;
export type PacienteContract = z.infer<typeof pacienteContract>;
