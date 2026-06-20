// Mapeo de estados de negocio -> variante visual del badge (colores del PDF §11.1).
// Pura y testeable; los colores reales salen de tokens CSS en el componente Badge.
export type BadgeVariant = 'info' | 'success' | 'warn' | 'danger' | 'neutral';

export function estadoBadgeVariant(estado: string | undefined | null): BadgeVariant {
  switch (estado) {
    case 'programada':
    case 'procesando':
      return 'info';
    case 'en_atencion':
      return 'warn';
    case 'realizada':
    case 'aprobada':
    case 'al_dia':
    case 'activa':
    case 'trial_activa':
      return 'success';
    case 'proxima':
    case 'proxima_a_vencer':
    case 'borrador':
    case 'por_vencer':
      return 'warn';
    case 'cancelada':
    case 'vencida':
    case 'error':
    case 'bloqueada_mora':
      return 'danger';
    case 'no_asistio':
    default:
      return 'neutral';
  }
}
