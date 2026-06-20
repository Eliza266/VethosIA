import { apiClient } from '../../lib/apiClient';

export interface Plan {
  id: string;
  nombre: string;
  precioMensualCOP: number;
  precioAnualCOP: number;
  asientosMax: number;
  limiteHistoriasMes: number;
  historiasGratisTrial: number;
  tipo: 'individual' | 'entidad' | 'ambos';
  activo: boolean;
}

export type CicloFacturacion = 'mensual' | 'anual';

export interface SuscripcionActual {
  id?: string;
  orgId?: string;
  veterinarioId?: string;
  planId?: string | null;
  estado?: string | null;
  limiteHistoriasMes?: number | null;
  asientosMax?: number | null;
  trialHasta?: string | number | Date | { seconds?: number; _seconds?: number } | null;
  vigenteHasta?: string | number | Date | { seconds?: number; _seconds?: number } | null;
  creadoEn?: string | number | Date | { seconds?: number; _seconds?: number } | null;
  ciclo?: CicloFacturacion | string | null;
  planNombre?: string | null;
}

export interface AsientosSuscripcion {
  usados: number;
  max: number;
}

export interface MiSuscripcionResponse {
  suscripcion?: SuscripcionActual | null;
  asientos?: AsientosSuscripcion | null;
}

export interface PagoLigero {
  id?: string;
  transactionId?: string;
  reference?: string;
  status?: string;
  amountInCents?: number;
  currency?: string;
  createdAt?: string | number | Date | { seconds?: number; _seconds?: number } | null;
  creadoEn?: string | number | Date | { seconds?: number; _seconds?: number } | null;
  planId?: string;
  subscriptionId?: string;
}

export type EstadoCartera =
  | 'al_dia'
  | 'pendiente'
  | 'vencido_1_30'
  | 'vencido_31_60'
  | 'vencido_60_mas'
  | 'bloqueado';

export interface CarteraCuenta {
  estado: EstadoCartera;
  diasVencido: number;
  vencimiento?: string | null;
  requierePago: boolean;
}

export interface ReciboLigero {
  id: string;
  transactionId: string;
  subscriptionId: string;
  reference: string;
  amountInCents: number;
  currency: string;
  estado: 'emitido';
  tipo: 'recibo_fase1_no_fiscal';
  fechaEmision: string;
  planId?: string | null;
}

export interface EstadoCuentaPagosResponse {
  cartera: CarteraCuenta;
  recibos: ReciboLigero[];
}

export type PagosProviderEstado = 'configurado' | 'incompleto' | 'deshabilitado';

export interface PagosConfigResponse {
  planOwnerId: string;
  planOwnerType: string;
  provider: 'wompi';
  estado: PagosProviderEstado;
  checkoutDisponible: boolean;
  puedeConfigurar: boolean;
  updatedAt?: string | null;
}

export interface ConfigurarWompiRequest {
  publicKey: string;
  privateKey: string;
  eventsSecret: string;
  integritySecret: string;
}

export const listarPlanes = async (): Promise<Plan[]> => {
  const res = await apiClient.get<Plan[]>('/v1/planes');
  return res.data ?? [];
};

export const crearPlan = async (plan: Omit<Plan, 'id'>): Promise<Plan> => {
  const res = await apiClient.post<Plan>('/v1/planes', plan);
  return res.data;
};

export const actualizarPlan = async (id: string, plan: Partial<Plan>): Promise<Plan> => {
  const res = await apiClient.patch<Plan>(`/v1/planes/${id}`, plan);
  return res.data;
};

export const miSuscripcion = async (): Promise<MiSuscripcionResponse> => {
  const res = await apiClient.get<MiSuscripcionResponse>('/v1/suscripciones/me');
  return res.data;
};

export const extenderTrial = async (id: string, dias = 7) => {
  const res = await apiClient.post(`/v1/suscripciones/${id}/extender-trial`, { dias });
  return res.data;
};

export const cambiarEstadoSuscripcion = async (id: string, estado: string) => {
  const res = await apiClient.patch(`/v1/suscripciones/${id}/estado`, { estado });
  return res.data;
};

export interface CheckoutRequest {
  planId: string;
  ciclo?: CicloFacturacion;
}

export interface CheckoutData {
  reference: string;
  amountInCents: number;
  currency: string;
  publicKey: string;
  signature: string;
  planId: string;
  subscriptionId: string;
}

export const buildCheckoutPayload = (input: CheckoutRequest): CheckoutRequest => {
  const payload: CheckoutRequest = { planId: input.planId };
  if (input.ciclo) payload.ciclo = input.ciclo;
  return payload;
};

export const crearCheckout = async (input: CheckoutRequest): Promise<CheckoutData> => {
  const res = await apiClient.post<CheckoutData>('/v1/pagos/checkout', buildCheckoutPayload(input));
  return res.data;
};

export const listarPagos = async (): Promise<PagoLigero[]> => {
  const res = await apiClient.get<PagoLigero[]>('/v1/pagos');
  return res.data ?? [];
};

export const estadoCuentaPagos = async (): Promise<EstadoCuentaPagosResponse> => {
  const res = await apiClient.get<EstadoCuentaPagosResponse>('/v1/pagos/me');
  return res.data;
};

export const pagosConfigMe = async (): Promise<PagosConfigResponse> => {
  const res = await apiClient.get<PagosConfigResponse>('/v1/pagos/config/me');
  return res.data;
};

export const configurarWompi = async (input: ConfigurarWompiRequest): Promise<PagosConfigResponse> => {
  const res = await apiClient.put<PagosConfigResponse>('/v1/pagos/config/wompi', input);
  return res.data;
};
