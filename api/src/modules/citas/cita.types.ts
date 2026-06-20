import type { AccountTypeV2, PlanOwnerTypeV2 } from '../../common/auth/auth-user.interface';

// Modelo de cita (agenda) + maquina de estados.
// programada -> en_atencion / realizada (con consulta) / cancelada / no_asistio
export type EstadoCita =
  | 'programada'
  | 'en_atencion'
  | 'realizada'
  | 'cancelada'
  | 'no_asistio';

export const ESTADOS_CITA: EstadoCita[] = [
  'programada',
  'en_atencion',
  'realizada',
  'cancelada',
  'no_asistio',
];

const TRANSICIONES: Record<EstadoCita, EstadoCita[]> = {
  programada: ['en_atencion', 'realizada', 'cancelada', 'no_asistio'],
  en_atencion: ['realizada', 'cancelada', 'no_asistio'],
  realizada: [],
  cancelada: [],
  no_asistio: [],
};

export function puedeTransicionar(desde: EstadoCita, hacia: EstadoCita): boolean {
  return TRANSICIONES[desde]?.includes(hacia) ?? false;
}

export function transicionesValidas(desde: EstadoCita): EstadoCita[] {
  return TRANSICIONES[desde] ?? [];
}

export interface CitaDoc {
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
  pacienteId?: string;
  /** Denormalizado del paciente al crear/vincular. */
  pacienteNombre?: string;
  propietarioNombre?: string;
  propietarioTelefono?: string;
  /** Motivo clinico de la cita (campo canonico). */
  motivo?: string;
  /** Legacy: texto libre antes de vincular paciente. */
  titulo: string;
  /** ISO datetime de la cita. */
  fecha: string;
  estado: EstadoCita;
  consultaId?: string;
  /** HC generada al aprobar la consulta vinculada (numeroHC). */
  historiaClinicaId?: string;
  notas?: string;
  creadoEn?: unknown;
  actualizadoEn?: unknown;
}
