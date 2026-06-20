import { findCapabilityModule, MODULE_STATUS_LABEL } from './capabilities';
import {
  clinicalRedirectPath,
  modulosInicioPorProfile,
  navItemsForProfile,
  navItemsForRole,
  normalizarRol,
  puedeOperarClinica,
  puedeVerModulo,
  puedeVerSuscripcion,
  type RbacProfileLike,
  type Rol,
  type RolCanonico,
  type RoleModule,
} from './rbac';

export type RoleRouteCapability = 'entidad' | 'veterinarias' | 'soporte';

function effectiveRole(profile: RbacProfileLike | null | undefined): RolCanonico | null {
  return normalizarRol(profile?.role ?? profile?.rol ?? null);
}

export function getNavbarItemsForProfile(
  profile: RbacProfileLike | null | undefined,
): RoleModule[] {
  return navItemsForProfile(profile);
}

export function getNavbarItemsForRole(rol: Rol | null | undefined): RoleModule[] {
  return navItemsForRole(rol);
}

export function getDashboardModulesForProfile(
  profile: RbacProfileLike | null | undefined,
): RoleModule[] {
  return modulosInicioPorProfile(profile);
}

export function getDashboardModulesForRole(rol: Rol | null | undefined): RoleModule[] {
  return modulosInicioPorProfile(typeof rol === 'string' ? { rol } : null);
}

export function getModuleStatusLabel(module: Pick<RoleModule, 'status'>): string {
  return MODULE_STATUS_LABEL[module.status];
}

export function getRoleHomePath(profile: RbacProfileLike | null | undefined): string {
  const rol = effectiveRole(profile);
  if (rol === 'superadmin') return '/admin';
  if (rol === 'admin_entidad') return '/entidad';
  return '/';
}

export function canAccessModule(
  profile: RbacProfileLike | null | undefined,
  moduleId: string,
): boolean {
  const rol = effectiveRole(profile);
  const module = findCapabilityModule(moduleId);
  if (!rol || !module || module.status === 'hidden') return false;
  if (!module.roles.includes(rol)) return false;
  if (!puedeVerModulo(module.rbacModulo, rol)) return false;
  if (moduleId === 'suscripcion') return puedeVerSuscripcion(profile);
  if (moduleId === 'veterinarias') return rol === 'admin_veterinaria';
  if (moduleId === 'entidad') return rol === 'admin_entidad';
  if (moduleId === 'soporte') return rol === 'superadmin';
  return true;
}

export function canAccessRoleRoute(
  profile: RbacProfileLike | null | undefined,
  required: RoleRouteCapability,
): boolean {
  return canAccessModule(profile, required);
}

export function canAccessClinicalRoutes(profile: RbacProfileLike | null | undefined): boolean {
  return puedeOperarClinica(profile) && canAccessModule(profile, 'pacientes');
}

export function canAccessBrigadas(profile: RbacProfileLike | null | undefined): boolean {
  return canAccessModule(profile, 'brigadas');
}

export function getDeniedRedirectPath(profile: RbacProfileLike | null | undefined): string {
  if (!profile) return '/';
  if (!canAccessClinicalRoutes(profile)) return clinicalRedirectPath(profile);
  return getRoleHomePath(profile);
}

export function canAccessPath(
  profile: RbacProfileLike | null | undefined,
  pathname: string,
): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/perfil' || path === '/notificaciones') return !!effectiveRole(profile);
  if (path === '/admin') return canAccessModule(profile, 'soporte');
  if (path === '/entidad') return canAccessModule(profile, 'entidad');
  if (path === '/veterinaria') return canAccessModule(profile, 'veterinarias');
  if (path === '/brigadas') return canAccessBrigadas(profile);
  if (path === '/agenda' || path === '/vacunas' || path === '/documentos' || path.startsWith('/pacientes')) {
    return canAccessClinicalRoutes(profile);
  }
  if (path === '/suscripcion' || path === '/mi-plan' || path === '/plan') {
    return puedeVerSuscripcion(profile);
  }
  if (path === '/planes' || path === '/suscripciones' || path === '/auditoria' || path === '/configuracion') {
    return canAccessModule(profile, 'soporte');
  }
  if (path === '/metricas') {
    const rol = effectiveRole(profile);
    return rol === 'admin_entidad' || rol === 'superadmin';
  }
  return false;
}
