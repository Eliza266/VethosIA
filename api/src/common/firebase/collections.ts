// Nombres de colecciones en un solo lugar para no andar con strings sueltos.
export const COLLECTIONS = {
  entidades: 'entidades',
  veterinarias: 'veterinarias',
  organizaciones: 'organizaciones',
  miembros: 'miembros',
  veterinarios: 'veterinarios',
  pacientes: 'pacientes',
  consultas: 'consultas',
  enmiendas: 'enmiendas',
  citas: 'citas',
  vacunas: 'vacunas',
  brigadas: 'brigadas',
  brigadaAtenciones: 'brigadaAtenciones',
  planes: 'planes',
  suscripciones: 'suscripciones',
  consumos: 'consumos',
  pagos: 'pagos',
  pagosConfig: 'pagosConfig',
  recibos: 'recibos',
  notificaciones: 'notificaciones',
  auditoria: 'auditoria',
  invitaciones: 'invitaciones',
  solicitudesTecnicas: 'solicitudesTecnicas',
  jobEventos: 'jobEventos',
  configuracion: 'configuracion',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

// Doc id del consumo mensual por veterinario (o por entidad, segun modalidad).
// Formato: {scopeId}_{YYYY-MM} para que el corte/reinicio sea por periodo.
export const consumoDocId = (scopeId: string, periodo: string): string => `${scopeId}_${periodo}`;

// Periodo actual en formato YYYY-MM (UTC) para el contador de consumo.
export const periodoActual = (d: Date = new Date()): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

// Doc del contador global legacy (el que revienta con carga). Lo mantenemos para compat.
export const CONTADOR_HC_LEGACY = 'contadorHC';

// Prefijo del contador por clinica (uno por org -> sin contencion entre clinicas).
export const contadorHcDocId = (orgId: string): string => `contadorHC_${orgId}`;

// Contador de IDs legibles de paciente (PAC-000256) por clinica.
export const contadorPacDocId = (orgId: string): string => `contadorPac_${orgId}`;

// Formato del id legible de paciente.
export const formatoPacId = (n: number): string => `PAC-${String(n).padStart(6, '0')}`;
