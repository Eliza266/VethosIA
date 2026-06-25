import type { AccountTypeV2, PlanOwnerTypeV2 } from '../../common/auth/auth-user.interface';
import type { DiagnosticoEstructurado } from './diagnostico-estructurado';

export interface ConsultaSoap {
  subjetivo?: string;
  objetivo?: string;
  analisis?: string;
  plan?: string;
  medicamentosSugeridos?: unknown[];
  generadoPorIA?: boolean;
}

export interface ConsultaSignosVitales {
  peso?: number | null;
  talla?: number | null;
  temperatura?: number | null;
  frecuenciaCardiaca?: number | null;
  frecuenciaRespiratoria?: number | null;
  condicionCorporal?: number | null;
}

export interface ConsultaDoc {
  id: string;
  numeroHC?: string;
  pacienteId?: string;
  veterinarioId?: string;
  orgId?: string;
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  membershipId?: string;
  legacyOrgId?: string;
  /** Cita de agenda que origino esta consulta. */
  citaId?: string;
  estado?: 'procesando' | 'borrador' | 'aprobada' | 'error';
  audioUrl?: string;
  /** URLs de cada bloque de audio (consultas grabadas en varias tomas). audioUrl = audioUrls[0]. */
  audioUrls?: string[];
  audioPath?: string;
  transcripcion?: string;
  motivo?: string;
  prioridad?: 'urgente' | 'rutina' | 'seguimiento' | 'brigada';
  signosVitales?: ConsultaSignosVitales;
  soap?: ConsultaSoap;
  diagnosticoEstructurado?: DiagnosticoEstructurado[];
  fechaHora?: unknown;
  creadoEn?: unknown;
  actualizadoEn?: unknown;
}
