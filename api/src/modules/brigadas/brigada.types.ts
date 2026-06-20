import type { AccountTypeV2, PlanOwnerTypeV2 } from '../../common/auth/auth-user.interface';

export type EstadoBrigada = 'planificada' | 'en_curso' | 'finalizada';

export interface UbicacionBrigada {
  direccion: string;
  ciudad: string;
  lat?: number;
  lng?: number;
}

export interface BrigadaDoc {
  id: string;
  nombre: string;
  descripcion?: string;
  fecha: string;
  ubicacion: UbicacionBrigada;
  veterinarioIds: string[];
  orgId?: string;
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  membershipId?: string;
  legacyOrgId?: string;
  estado: EstadoBrigada;
  totalConsultas?: number;
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface BrigadaAtencionDoc {
  id: string;
  brigadaId: string;
  pacienteId?: string;
  consultaId?: string;
  veterinarioId: string;
  motivo: string;
  notas?: string;
  especie?: string;
  fechaHora: string;
  orgId?: string;
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  membershipId?: string;
  legacyOrgId?: string;
  createdBy: string;
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface BrigadaConsolidado {
  brigadaId: string;
  nombre: string;
  estado: EstadoBrigada;
  fecha: string;
  entidadId?: string;
  veterinariaId?: string;
  totalAtenciones: number;
  pacientesUnicos: number;
  veterinariosParticipantes: number;
  veterinariosConAtencion: number;
}
