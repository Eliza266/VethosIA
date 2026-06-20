import type { Plan, PagoLigero } from '../../features/saas/api';
import type {
  BackofficeAuditoria,
  BackofficeConsumo,
  BackofficeEntidad,
  BackofficeMiembro,
  BackofficeVeterinaria,
} from '../../features/backoffice/api';
import type { SystemConfigPublicView } from '../../features/plataforma/api';
import type { MeProfile, SolicitudTecnica } from '../../features/tenant/api';

export type SuperAdminSection =
  | 'overview'
  | 'entidades'
  | 'veterinarias'
  | 'usuarios'
  | 'planes'
  | 'suscripciones'
  | 'pagos'
  | 'auditoria'
  | 'configuracion';

export type EntidadDraft = {
  nombre: string;
  tipo: '' | NonNullable<BackofficeEntidad['tipo']>;
  direccion: string;
  ciudad: string;
  pais: string;
  telefono: string;
  emailContacto: string;
  logoUrl: string;
  estado: BackofficeEntidad['estado'];
};

export type SedeDraft = Pick<BackofficeVeterinaria, 'nombre' | 'ciudad' | 'estado'>;

export type SedeCreateDraft = {
  entidadId: string;
  nombre: string;
  ciudad: string;
  pais: string;
  emailContacto: string;
  planOwnerType: BackofficeVeterinaria['planOwnerType'];
};

export interface SuperAdminRelations {
  entidadById: Map<string, BackofficeEntidad>;
  sedesByEntidad: Map<string, BackofficeVeterinaria[]>;
  vetsBySede: Map<string, BackofficeMiembro[]>;
  consumoBySede: Map<string, BackofficeConsumo[]>;
  consumoByEntidad: Map<string, BackofficeConsumo[]>;
}

export interface SuperAdminDataset {
  me?: MeProfile;
  entidades: BackofficeEntidad[];
  veterinarias: BackofficeVeterinaria[];
  miembros: BackofficeMiembro[];
  consumos: BackofficeConsumo[];
  suscripciones: Array<Record<string, unknown>>;
  auditoria: BackofficeAuditoria[];
  solicitudes: SolicitudTecnica[];
  planes: Plan[];
  pagos: PagoLigero[];
  systemConfig?: SystemConfigPublicView;
  relations: SuperAdminRelations;
}

export interface SuperAdminLoadingState {
  entidades?: boolean;
  veterinarias?: boolean;
  miembros?: boolean;
  consumos?: boolean;
  suscripciones?: boolean;
  auditoria?: boolean;
  solicitudes?: boolean;
  planes?: boolean;
  pagos?: boolean;
  systemConfig?: boolean;
}

export interface SuperAdminActionState {
  crearPlan?: boolean;
  crearEntidad?: boolean;
  editarEntidad?: boolean;
  crearSede?: boolean;
  editarSede?: boolean;
  cambiarBloqueo?: boolean;
  solicitudTecnica?: boolean;
}
