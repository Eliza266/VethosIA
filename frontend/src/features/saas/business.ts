import type { ConsumoActual } from '../metricas/api';
import {
  esVeterinarioIndependiente,
  esVeterinarioVinculado,
  normalizarRol,
  type RbacProfileLike,
  type Rol,
} from '../../lib/rbac';

export type DateLike = string | number | Date | { seconds?: number; _seconds?: number } | null | undefined;

export interface EstadoCuentaVisual {
  label: string;
  badgeEstado: string;
  detalle: string;
}

export function estadoCuentaVisual(estado: string | null | undefined): EstadoCuentaVisual {
  switch (estado) {
    case 'activa':
    case 'trial_activa':
    case 'al_dia':
      return {
        label: 'Al día',
        badgeEstado: estado,
        detalle: 'La cuenta puede operar dentro de su plan actual.',
      };
    case 'por_vencer':
      return {
        label: 'Por vencer',
        badgeEstado: 'por_vencer',
        detalle: 'Revisa el ciclo de facturación para evitar bloqueo operativo.',
      };
    case 'vencida':
    case 'vencido_1_30':
    case 'vencido_31_60':
    case 'vencido_60_mas':
      return {
        label: 'Vencido',
        badgeEstado: 'vencida',
        detalle: 'Hay una obligación pendiente asociada a la suscripción.',
      };
    case 'bloqueada_mora':
    case 'bloqueado_fin_trial':
    case 'bloqueado':
      return {
        label: 'Bloqueado',
        badgeEstado: 'bloqueada_mora',
        detalle: 'La cuenta requiere regularización antes de usar acciones de pago.',
      };
    case 'pendiente':
      return {
        label: 'Pendiente',
        badgeEstado: 'por_vencer',
        detalle: 'El estado está pendiente de confirmación.',
      };
    case 'desactivado':
    case 'cancelada':
      return {
        label: 'Desactivado',
        badgeEstado: 'cancelada',
        detalle: 'La suscripción no está activa.',
      };
    default:
      return {
        label: 'Sin suscripción',
        badgeEstado: 'neutral',
        detalle: 'Aún no hay una suscripción activa para esta cuenta.',
      };
  }
}

export function consumoScopeLabel(rol: Rol | null | undefined): string {
  switch (normalizarRol(rol)) {
    case 'admin_entidad':
      return 'Consumo agregado entidad';
    case 'admin_veterinaria':
      return 'Consumo de veterinaria';
    case 'veterinario':
      return 'Consumo personal/cuenta';
    case 'superadmin':
      return 'Resumen soporte plataforma';
    default:
      return 'Consumo';
  }
}

export function puedeVerResumenNegocio(input: Rol | RbacProfileLike | null | undefined): boolean {
  const profile: RbacProfileLike | null =
    typeof input === 'string' ? { rol: input } : input ?? null;
  const rol = normalizarRol(profile?.role ?? profile?.rol ?? null);
  if (rol === 'admin_entidad' || rol === 'admin_veterinaria') return true;
  if (rol !== 'veterinario') return false;
  if (esVeterinarioVinculado(profile)) return false;
  return esVeterinarioIndependiente(profile);
}

export function consumoPorcentaje(consumo: Pick<ConsumoActual, 'porcentaje' | 'usados' | 'limite'> | null | undefined): number {
  if (!consumo) return 0;
  const raw = Number.isFinite(consumo.porcentaje)
    ? consumo.porcentaje
    : consumo.limite > 0
      ? (consumo.usados / consumo.limite) * 100
      : 0;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function formatBusinessDate(value: DateLike): string | null {
  if (!value) return null;
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'object') {
    const seconds = value.seconds ?? value._seconds;
    if (typeof seconds !== 'number') return null;
    date = new Date(seconds * 1000);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(date);
}

export function formatCOPFromCents(amountInCents: number | null | undefined): string {
  if (typeof amountInCents !== 'number' || Number.isNaN(amountInCents)) return 'Monto no disponible';
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amountInCents / 100)} COP`;
}

export function pagosEnLineaLabel(estado: string | null | undefined): string {
  switch (estado) {
    case 'configurado':
      return 'Pagos en línea configurados';
    case 'deshabilitado':
      return 'Pagos en línea deshabilitados';
    default:
      return 'Pagos en línea no configurados';
  }
}

export function checkoutHabilitado(config: { checkoutDisponible?: boolean } | null | undefined): boolean {
  return config?.checkoutDisponible === true;
}
