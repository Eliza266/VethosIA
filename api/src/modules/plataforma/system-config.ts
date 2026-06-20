// Config temporal Fase 1 para jobs internos. TODO(superadmin-config):
// mover estos valores a configuracion administrable cuando exista el modulo correspondiente.
export const SYSTEM_CONFIG = {
  suscripcionDiasPorVencer: 5,
  suscripcionDiasGracia: 5,
  consumoAlertaPorcentaje: 80,
  sesionInactivaHoras: 8,
  citaProximaHoras: 2,
  citaDiaAnteriorHoras: 24,
  vacunasVentanaProximaDias: 30,
  invitacionTtlHoras: 48,
} as const;

export type SystemConfig = typeof SYSTEM_CONFIG;
