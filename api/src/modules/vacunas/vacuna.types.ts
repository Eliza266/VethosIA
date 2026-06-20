import type { AccountTypeV2, PlanOwnerTypeV2 } from '../../common/auth/auth-user.interface';

export type EstadoVacuna = 'al_dia' | 'proxima_a_vencer' | 'vencida';
export type FuenteVacuna = 'catalogo_base' | 'personalizada';

export const VENTANA_PROXIMA_DIAS = 30;

const MS_DIA = 24 * 60 * 60 * 1000;

const dateOnlyUtc = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

export function parseFechaVacuna(value: string | undefined | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateOnlyUtc(date);
}

export function fechaIsoDia(date: Date): string {
  return dateOnlyUtc(date).toISOString().slice(0, 10);
}

export function sumarDiasFechaVacuna(fecha: string | undefined | null, dias?: number): string | undefined {
  if (!fecha || !dias || dias <= 0) return undefined;
  const base = parseFechaVacuna(fecha);
  if (!base) return undefined;
  base.setUTCDate(base.getUTCDate() + dias);
  return fechaIsoDia(base);
}

export function calcularEstadoVacuna(
  proximaDosis: string | undefined | null,
  hoy: Date = new Date(),
  ventanaDias: number = VENTANA_PROXIMA_DIAS,
): EstadoVacuna {
  const prox = parseFechaVacuna(proximaDosis);
  if (!prox) return 'al_dia';
  const baseHoy = dateOnlyUtc(hoy);
  const diffDias = Math.floor((prox.getTime() - baseHoy.getTime()) / MS_DIA);
  if (diffDias < 0) return 'vencida';
  if (diffDias <= ventanaDias) return 'proxima_a_vencer';
  return 'al_dia';
}

export interface VacunaDoc {
  id: string;
  orgId?: string;
  veterinarioId?: string;
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  membershipId?: string;
  legacyOrgId?: string;
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
  eliminadaEn?: string;
  creadoEn?: unknown;
}
