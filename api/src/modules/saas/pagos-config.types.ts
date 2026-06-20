import type { PlanOwnerTypeV2 } from '../../common/auth/auth-user.interface';

export type PagosProviderEstado = 'configurado' | 'incompleto' | 'deshabilitado';

export interface PagosConfigDoc {
  planOwnerId: string;
  planOwnerType: PlanOwnerTypeV2;
  provider: 'wompi';
  estado: PagosProviderEstado;
  /** Nombres de recurso en Secret Manager; nunca valores en claro. */
  secretPublicKey: string;
  secretPrivateKey: string;
  secretEventsSecret: string;
  secretIntegritySecret: string;
  updatedAt?: unknown;
  updatedBy?: string;
}

export interface PagosConfigPublicView {
  planOwnerId: string;
  planOwnerType: PlanOwnerTypeV2;
  provider: 'wompi';
  estado: PagosProviderEstado;
  checkoutDisponible: boolean;
  puedeConfigurar: boolean;
  updatedAt?: string | null;
}

export interface WompiCredentials {
  publicKey: string;
  privateKey: string;
  eventsSecret: string;
  integritySecret: string;
}
