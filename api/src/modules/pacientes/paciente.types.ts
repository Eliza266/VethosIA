import type { AccountTypeV2, PlanOwnerTypeV2 } from '../../common/auth/auth-user.interface';

export type Sexo = 'macho' | 'hembra' | 'desconocido';
export type EstadoReproductivo = 'entero' | 'castrado' | 'esterilizado' | 'desconocido';

export interface Propietario {
  nombre?: string;
  telefono?: string;
  email?: string;
  whatsapp?: string;
  codigoPais?: string;
}

export interface PacienteDoc {
  id: string;
  codigo?: string;
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
  nombre: string;
  especie?: string;
  raza?: string;
  fechaNacimiento?: string;
  edad?: string;
  sexo?: Sexo;
  estadoReproductivo?: EstadoReproductivo;
  color?: string;
  chip?: string;
  /** URL de Firebase Storage (fotos-pacientes/{orgId}/{pacienteId}/...). */
  foto?: string;
  propietario?: Propietario;
  notas?: string;
  ultimoPeso?: number;
  ultimaTalla?: number;
  deletedAt?: string | null;
  /** true si se creo automaticamente desde "consulta rapida" y aun no se confirmo. */
  esPlaceholder?: boolean;
  creadoEn?: unknown;
}

export type PacienteCreate = Omit<PacienteDoc, 'id' | 'codigo' | 'creadoEn' | 'deletedAt'>;
export type PacienteUpdate = Partial<
  Omit<
    PacienteDoc,
    | 'id'
    | 'orgId'
    | 'veterinarioId'
    | 'accountType'
    | 'accountId'
    | 'entidadId'
    | 'veterinariaId'
    | 'planOwnerType'
    | 'planOwnerId'
    | 'membershipId'
    | 'legacyOrgId'
    | 'codigo'
  >
>;
