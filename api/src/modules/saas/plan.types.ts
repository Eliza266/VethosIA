import { EstadoSuscripcion } from './suscripcion.state';
import type { PlanOwnerTypeV2 } from '../../common/auth/auth-user.interface';

export type TipoPlan = 'individual' | 'entidad' | 'ambos';

export interface PlanDoc {
  id: string;
  nombre: string;
  descripcion?: string;
  precioMensualCOP: number;
  precioAnualCOP: number;
  // Precio en USD (fase 1: solo informativo, definido a mano; el cobro real sigue en
  // COP via Wompi). Opcional para no romper planes ya creados sin este dato.
  precioMensualUSD?: number;
  precioAnualUSD?: number;
  asientosMax: number;
  limiteHistoriasMes: number;
  historiasGratisTrial: number;
  tipo: TipoPlan;
  activo: boolean;
}

export interface SuscripcionDoc {
  id: string;
  orgId?: string;
  veterinarioId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  entidadId?: string;
  veterinariaId?: string;
  planId: string;
  estado: EstadoSuscripcion;
  // limite efectivo (cacheado del plan al momento de asignar, para no releer siempre).
  limiteHistoriasMes?: number;
  asientosMax?: number;
  trialHasta?: string;
  vigenteHasta?: string;
  creadoEn?: unknown;
}

// Limite por defecto cuando no hay suscripcion configurada (trial inicial).
export const LIMITE_TRIAL_DEFECTO = 30;
