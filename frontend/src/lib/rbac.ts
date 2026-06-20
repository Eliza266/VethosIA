import {
  DASHBOARD_CAPABILITY,
  ROLE_CAPABILITY_MODULES,
  type CapabilityCategory,
  type CapabilityModule,
  type CapabilityStatus,
} from './capabilities';

// Matriz de modulos por rol. V2 usa roles explicitos; legacy se conserva:
// `admin` => Admin Entidad, `vet` => Veterinario. `asistente` queda legacy
// deprecated y no se normaliza a ningun rol canonico V2.
export type Rol =
  | 'superadmin'
  | 'admin'
  | 'admin_entidad'
  | 'admin_veterinaria'
  | 'vet'
  | 'veterinario'
  | 'asistente';

export const ROLES_CANONICOS = [
  'superadmin',
  'admin_entidad',
  'admin_veterinaria',
  'veterinario',
] as const;

export type RolCanonico = (typeof ROLES_CANONICOS)[number];

export type Modulo =
  | 'entidades'
  | 'veterinarias'
  | 'veterinarios'
  | 'equipo'
  | 'planes'
  | 'consumo'
  | 'pacientes'
  | 'consultaIA'
  | 'pdf'
  | 'agenda'
  | 'brigadas'
  | 'vacunas'
  | 'metricas'
  | 'notificaciones'
  | 'auditoria'
  | 'configuracion'
  | 'soporte';

export type Nivel = 'total' | 'parcial' | 'restringido' | 'limitado';
export type NavIcon =
  | 'dashboard'
  | 'pacientes'
  | 'agenda'
  | 'vacunas'
  | 'brigadas'
  | 'nuevo'
  | 'entidad'
  | 'veterinaria'
  | 'suscripcion'
  | 'soporte';

export interface RoleModule {
  id: string;
  label: string;
  description: string;
  path: string;
  modulo: Modulo;
  icon: NavIcon;
  roles: RolCanonico[];
  status: CapabilityStatus;
  category: CapabilityCategory;
  priority: number;
  showInNavbar: boolean;
  showInDashboard: boolean;
  requiresTenant: boolean;
  requiresPlanOwner?: boolean;
  badge?: string;
}

export type AccountTypeLike = 'vet_individual' | 'veterinaria' | 'entidad';
export type PlanOwnerTypeLike = 'vet' | 'veterinaria' | 'entidad';

export interface RbacProfileLike {
  rol?: Rol | null;
  role?: RolCanonico | null;
  orgId?: string | null;
  accountType?: AccountTypeLike | string | null;
  accountId?: string | null;
  entidadId?: string | null;
  veterinariaId?: string | null;
  membershipId?: string | null;
  planOwnerType?: PlanOwnerTypeLike | string | null;
  planOwnerId?: string | null;
}

function hasValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function normalizarRol(rol: Rol | null | undefined): RolCanonico | null {
  switch (rol) {
    case 'superadmin':
      return 'superadmin';
    case 'admin':
    case 'admin_entidad':
      return 'admin_entidad';
    case 'admin_veterinaria':
      return 'admin_veterinaria';
    case 'vet':
    case 'veterinario':
      return 'veterinario';
    default:
      return null;
  }
}

function rolEfectivo(input: Rol | RbacProfileLike | null | undefined): Rol | RolCanonico | null {
  if (typeof input === 'string') return input;
  return input?.role ?? input?.rol ?? null;
}

export function esVeterinarioVinculado(profile: RbacProfileLike | null | undefined): boolean {
  if (normalizarRol(rolEfectivo(profile)) !== 'veterinario') return false;
  if (profile?.accountType === 'vet_individual' || profile?.planOwnerType === 'vet') return false;
  return (
    hasValue(profile?.orgId) ||
    hasValue(profile?.entidadId) ||
    hasValue(profile?.veterinariaId) ||
    profile?.accountType === 'entidad' ||
    profile?.accountType === 'veterinaria' ||
    profile?.planOwnerType === 'entidad' ||
    profile?.planOwnerType === 'veterinaria'
  );
}

export function esVeterinarioIndependiente(profile: RbacProfileLike | null | undefined): boolean {
  if (normalizarRol(rolEfectivo(profile)) !== 'veterinario') return false;
  if (esVeterinarioVinculado(profile)) return false;
  if (profile?.accountType && profile.accountType !== 'vet_individual') return false;
  if (profile?.planOwnerType && profile.planOwnerType !== 'vet') return false;
  return true;
}

export function puedeGestionarSuscripcion(input: Rol | RbacProfileLike | null | undefined): boolean {
  const profile: RbacProfileLike | null =
    typeof input === 'string' ? { rol: input } : input ?? null;
  const canonico = normalizarRol(rolEfectivo(profile));
  if (canonico === 'admin_entidad') return true;
  if (canonico === 'admin_veterinaria') {
    return (
      profile?.planOwnerType === 'veterinaria' &&
      hasValue(profile.planOwnerId) &&
      hasValue(profile.veterinariaId) &&
      profile.planOwnerId === profile.veterinariaId
    );
  }
  if (canonico === 'veterinario') return esVeterinarioIndependiente(profile);
  return false;
}

export function puedeVerSuscripcion(input: Rol | RbacProfileLike | null | undefined): boolean {
  const profile: RbacProfileLike | null =
    typeof input === 'string' ? { rol: input } : input ?? null;
  const canonico = normalizarRol(rolEfectivo(profile));
  if (canonico === 'admin_entidad') return true;
  if (canonico === 'admin_veterinaria') return hasValue(profile?.veterinariaId);
  if (canonico === 'veterinario') return esVeterinarioIndependiente(profile);
  return false;
}

export function puedeOperarClinica(input: Rol | RbacProfileLike | null | undefined): boolean {
  const profile: RbacProfileLike | null =
    typeof input === 'string' ? { rol: input } : input ?? null;
  const canonico = normalizarRol(rolEfectivo(profile));
  if (canonico === 'veterinario') return true;
  if (canonico !== 'admin_veterinaria') return false;
  return typeof input === 'string' || hasValue(profile?.veterinariaId);
}

export function clinicalRedirectPath(input: Rol | RbacProfileLike | null | undefined): string {
  const profile: RbacProfileLike | null =
    typeof input === 'string' ? { rol: input } : input ?? null;
  const canonico = normalizarRol(rolEfectivo(profile));
  if (canonico === 'superadmin') return '/admin';
  if (canonico === 'admin_entidad') return '/entidad';
  return '/';
}

export const MATRIZ: Record<Modulo, Record<RolCanonico, Nivel>> = {
  entidades: {
    superadmin: 'total',
    admin_entidad: 'total',
    admin_veterinaria: 'restringido',
    veterinario: 'restringido',
  },
  veterinarias: {
    superadmin: 'total',
    admin_entidad: 'total',
    admin_veterinaria: 'parcial',
    veterinario: 'restringido',
  },
  veterinarios: {
    superadmin: 'total',
    admin_entidad: 'total',
    admin_veterinaria: 'total',
    veterinario: 'restringido',
  },
  equipo: {
    superadmin: 'total',
    admin_entidad: 'total',
    admin_veterinaria: 'total',
    veterinario: 'restringido',
  },
  planes: {
    superadmin: 'total',
    admin_entidad: 'total',
    admin_veterinaria: 'parcial',
    veterinario: 'restringido',
  },
  consumo: {
    superadmin: 'total',
    admin_entidad: 'total',
    admin_veterinaria: 'total',
    veterinario: 'parcial',
  },
  pacientes: {
    superadmin: 'parcial',
    admin_entidad: 'parcial',
    admin_veterinaria: 'total',
    veterinario: 'total',
  },
  consultaIA: {
    superadmin: 'parcial',
    admin_entidad: 'restringido',
    admin_veterinaria: 'parcial',
    veterinario: 'total',
  },
  pdf: {
    superadmin: 'parcial',
    admin_entidad: 'parcial',
    admin_veterinaria: 'total',
    veterinario: 'total',
  },
  agenda: {
    superadmin: 'parcial',
    admin_entidad: 'parcial',
    admin_veterinaria: 'total',
    veterinario: 'total',
  },
  brigadas: {
    superadmin: 'restringido',
    admin_entidad: 'total',
    admin_veterinaria: 'total',
    veterinario: 'parcial',
  },
  vacunas: {
    superadmin: 'parcial',
    admin_entidad: 'parcial',
    admin_veterinaria: 'total',
    veterinario: 'total',
  },
  metricas: {
    superadmin: 'total',
    admin_entidad: 'total',
    admin_veterinaria: 'parcial',
    veterinario: 'parcial',
  },
  notificaciones: {
    superadmin: 'total',
    admin_entidad: 'total',
    admin_veterinaria: 'total',
    veterinario: 'total',
  },
  auditoria: {
    superadmin: 'total',
    admin_entidad: 'parcial',
    admin_veterinaria: 'limitado',
    veterinario: 'limitado',
  },
  configuracion: {
    superadmin: 'total',
    admin_entidad: 'parcial',
    admin_veterinaria: 'parcial',
    veterinario: 'restringido',
  },
  soporte: {
    superadmin: 'total',
    admin_entidad: 'restringido',
    admin_veterinaria: 'restringido',
    veterinario: 'restringido',
  },
};

export function nivelAcceso(modulo: Modulo, rol: Rol | null | undefined): Nivel {
  const canonico = normalizarRol(rol);
  if (!canonico) return 'restringido';
  return MATRIZ[modulo][canonico];
}

export function puedeVerModulo(modulo: Modulo, rol: Rol | null | undefined): boolean {
  return nivelAcceso(modulo, rol) !== 'restringido';
}

export const MENSAJE_SIN_PERMISO_ELIMINAR = 'Tu rol no permite eliminar registros.';
export const MENSAJE_SIN_PERMISO_APROBAR =
  'Solo veterinarios o administradores pueden aprobar historias clinicas.';

export function puedeEliminar(input: Rol | RbacProfileLike | null | undefined): boolean {
  return puedeOperarClinica(input);
}

export function puedeAprobar(input: Rol | RbacProfileLike | null | undefined): boolean {
  return puedeOperarClinica(input);
}

export function rolLabel(rol: Rol | null | undefined): string {
  switch (normalizarRol(rol)) {
    case 'superadmin':
      return 'Super Admin';
    case 'admin_entidad':
      return 'Admin Entidad';
    case 'admin_veterinaria':
      return 'Admin Veterinaria';
    case 'veterinario':
      return 'Veterinario';
    default:
      return rol === 'asistente' ? 'Rol legacy' : 'Invitado';
  }
}

function roleModuleFromCapability(module: CapabilityModule): RoleModule {
  return {
    id: module.id,
    label: module.label,
    description: module.description,
    path: module.path,
    modulo: module.rbacModulo as Modulo,
    icon: module.icon as NavIcon,
    roles: [...module.roles] as RolCanonico[],
    status: module.status,
    category: module.category,
    priority: module.priority,
    showInNavbar: module.showInNavbar,
    showInDashboard: module.showInDashboard,
    requiresTenant: module.requiresTenant,
    requiresPlanOwner: module.requiresPlanOwner,
    badge: module.badge,
  };
}

const ROLE_MODULES: RoleModule[] = ROLE_CAPABILITY_MODULES.map(roleModuleFromCapability);

const BASE_NAV_ITEM: RoleModule = roleModuleFromCapability(DASHBOARD_CAPABILITY);

const NAV_VISIBLE_IDS = ROLE_CAPABILITY_MODULES.filter((module) => module.showInNavbar).map(
  (module) => module.id,
);

const suscripcionModule = () => ROLE_MODULES.find((m) => m.id === 'suscripcion');

export function modulosInicioPorRol(rol: Rol | null | undefined): RoleModule[] {
  const canonico = normalizarRol(rol);
  if (!canonico) return [];
  return ROLE_MODULES.filter(
    (m) =>
      m.showInDashboard &&
      m.status !== 'hidden' &&
      m.roles.includes(canonico) &&
      puedeVerModulo(m.modulo, canonico),
  ).sort((a, b) => a.priority - b.priority);
}

export function modulosInicioPorProfile(profile: RbacProfileLike | null | undefined): RoleModule[] {
  const modules = modulosInicioPorRol(rolEfectivo(profile));
  if (!puedeVerSuscripcion(profile)) {
    return modules.filter((m) => m.id !== 'suscripcion');
  }
  if (modules.some((m) => m.id === 'suscripcion')) {
    return modules;
  }
  const suscripcion = suscripcionModule();
  return suscripcion ? [...modules, suscripcion] : modules;
}

export function navItemsForRole(rol: Rol | null | undefined): RoleModule[] {
  const canonico = normalizarRol(rol);
  if (!canonico) return [];
  const visible = modulosInicioPorRol(canonico).filter((m) =>
    NAV_VISIBLE_IDS.includes(m.id),
  );
  return [BASE_NAV_ITEM, ...visible];
}

export function navItemsForProfile(profile: RbacProfileLike | null | undefined): RoleModule[] {
  const canonico = normalizarRol(rolEfectivo(profile));
  if (!canonico) return [];
  const visible = modulosInicioPorProfile(profile).filter((m) => NAV_VISIBLE_IDS.includes(m.id));
  return [BASE_NAV_ITEM, ...visible];
}
