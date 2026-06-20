// Lo que cargamos en req.user despues de verificar el ID token.
// superadmin = dueño de VetIA (cross-tenant); admin = admin de una entidad/clinica;
// vet = veterinario; asistente = staff sin permisos de borrado.
export type Rol = 'superadmin' | 'admin' | 'vet' | 'asistente';
// Nota: `asistente` es legacy/deprecated; no forma parte de `RolV2`.

// Roles canonicos V2. `sistema` es un actor tecnico server-side, no un rol
// humano que deba salir de Firebase Auth hacia endpoints tenant normales.
export const ROLES_HUMANOS_V2 = [
  'superadmin',
  'admin_entidad',
  'admin_veterinaria',
  'veterinario',
] as const;
export type RolV2 = (typeof ROLES_HUMANOS_V2)[number];
export type ActorSistemaV2 = 'sistema';

export type AccountTypeV2 = 'vet_individual' | 'veterinaria' | 'entidad';
export type PlanOwnerTypeV2 = 'vet' | 'veterinaria' | 'entidad';
export const VINCULOS_HUMANOS_V2 = ['staff', 'freelance', 'owner'] as const;
export type VinculoTipoV2 = (typeof VINCULOS_HUMANOS_V2)[number];

// Orden jerarquico: un rol "incluye" los permisos de los de menor nivel.
export const JERARQUIA_ROL: Record<Rol, number> = {
  superadmin: 3,
  admin: 2,
  vet: 1,
  asistente: 0,
};

export interface AuthUser {
  uid: string;
  email?: string;
  // vienen de los custom claims seteados por el backend al crear/asignar miembro.
  // pueden faltar en usuarios legacy que todavia no migraron a una org.
  orgId?: string;
  rol?: Rol;
  // Claims V2 opcionales. Se agregan al mismo objeto de runtime para que los
  // endpoints existentes puedan seguir recibiendo AuthUser sin romper legacy.
  v?: 2;
  role?: RolV2;
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  membershipId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  vinculoTipo?: VinculoTipoV2;
}

// Representa un contexto V2 ya resuelto. No reemplaza `AuthUser` todavia: Fase 0
// solo lo usa en helpers puros y tests, sin activar parseo de claims V2.
export interface AuthUserV2 extends AuthUser {
  v: 2;
  role: RolV2;
  accountType?: AccountTypeV2;
  accountId?: string;
  entidadId?: string;
  veterinariaId?: string;
  membershipId?: string;
  planOwnerType?: PlanOwnerTypeV2;
  planOwnerId?: string;
  vinculoTipo?: VinculoTipoV2;
}

import type { Request } from 'express';

// Request de Express con el usuario ya resuelto por el AuthGuard.
export interface RequestWithUser extends Request {
  user: AuthUser;
}
