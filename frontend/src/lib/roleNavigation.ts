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

// --- Catálogo de módulos del dueño-veterinario (admin_veterinaria) ---
// Única fuente de verdad por modo. Antes estas listas vivían inline y duplicadas
// dentro de getNavbarItemsForProfile y getDashboardModulesForProfile (una para el
// navbar/sidebar y otra para el dashboard de inicio). Ahora se definen una sola vez
// y cada superficie filtra por su flag: navbar -> showInNavbar, dashboard -> showInDashboard.
// El orden del arreglo es el orden de despliegue (no se reordena al filtrar).

type AdminVetMode = 'admin' | 'veterinario';

const ADMIN_VET_CATALOG: Record<AdminVetMode, RoleModule[]> = {
  veterinario: [
    {
      id: 'dashboard',
      label: 'Dashboard clínico',
      description: 'Inicio operativo clínico.',
      path: '/',
      icon: 'dashboard',
      roles: ['veterinario'],
      status: 'active',
      category: 'operations',
      priority: 0,
      showInNavbar: true,
      showInDashboard: false,
      requiresTenant: false,
      modulo: 'notificaciones',
    },
    {
      id: 'pacientes',
      label: 'Pacientes',
      description: 'Historias clínicas, propietarios y seguimiento operativo.',
      path: '/pacientes',
      icon: 'pacientes',
      roles: ['veterinario'],
      status: 'active',
      category: 'clinical',
      priority: 30,
      showInNavbar: true,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'pacientes',
    },
    {
      id: 'agenda',
      label: 'Agenda',
      description: 'Citas del día, seguimiento y atención programada.',
      path: '/agenda',
      icon: 'agenda',
      roles: ['veterinario'],
      status: 'active',
      category: 'clinical',
      priority: 40,
      showInNavbar: true,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'agenda',
    },
    {
      id: 'vacunas',
      label: 'Vacunas',
      description: 'Próximas dosis, vencimientos y seguimiento por paciente.',
      path: '/vacunas',
      icon: 'vacunas',
      roles: ['veterinario'],
      status: 'active',
      category: 'clinical',
      priority: 50,
      showInNavbar: true,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'vacunas',
    },
    {
      id: 'brigadas',
      label: 'Brigadas',
      description: 'Jornadas clínicas y atenciones agrupadas.',
      path: '/brigadas',
      icon: 'brigadas',
      roles: ['veterinario'],
      status: 'active',
      category: 'operations',
      priority: 60,
      showInNavbar: true,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'brigadas',
    },
    {
      id: 'nueva-consulta',
      label: 'Nueva consulta',
      description: 'Elige un paciente para iniciar audio, modo manual, SOAP e historia médica.',
      path: '/pacientes',
      icon: 'nuevo',
      roles: ['veterinario'],
      status: 'active',
      category: 'clinical',
      priority: 70,
      showInNavbar: true,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'consultaIA',
      badge: 'Clínico',
    },
    {
      id: 'consulta-soap',
      label: 'Consulta SOAP',
      description: 'Borrador, aprobación clínica, historia y revisión de nota estructurada.',
      path: '/pacientes',
      icon: 'nuevo',
      roles: ['veterinario'],
      status: 'active',
      category: 'clinical',
      priority: 80,
      showInNavbar: false,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'consultaIA',
    },
    {
      id: 'nuevo-paciente',
      label: 'Nuevo paciente',
      description: 'Registro operativo de pacientes dentro de la cuenta.',
      path: '/pacientes/nuevo',
      icon: 'nuevo',
      roles: ['veterinario'],
      status: 'active',
      category: 'clinical',
      priority: 90,
      showInNavbar: false,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'pacientes',
    },
  ],
  admin: [
    {
      id: 'dashboard',
      label: 'Resumen',
      description: 'Inicio operativo por rol.',
      path: '/',
      icon: 'dashboard',
      roles: ['admin_veterinaria'],
      status: 'active',
      category: 'operations',
      priority: 0,
      showInNavbar: true,
      showInDashboard: false,
      requiresTenant: false,
      modulo: 'notificaciones',
    },
    {
      id: 'veterinarias',
      label: 'Mi veterinaria',
      description: 'Equipo, perfil y operación de la veterinaria activa.',
      path: '/veterinaria',
      icon: 'veterinaria',
      roles: ['admin_veterinaria'],
      status: 'active',
      category: 'tenant',
      priority: 10,
      showInNavbar: true,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'veterinarias',
      badge: 'Gestión',
    },
    {
      id: 'equipo-clinico',
      label: 'Equipo clínico',
      description: 'Veterinarios vinculados, invitaciones y solicitudes técnicas de la sede.',
      path: '/veterinaria',
      icon: 'veterinaria',
      roles: ['admin_veterinaria'],
      status: 'active',
      category: 'tenant',
      priority: 20,
      showInNavbar: true,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'equipo',
    },
    {
      id: 'metricas',
      label: 'Métricas',
      description: 'Resumen de métricas de la veterinaria.',
      path: '/metricas',
      icon: 'brigadas',
      roles: ['admin_veterinaria'],
      status: 'active',
      category: 'operations',
      priority: 30,
      showInNavbar: true,
      showInDashboard: false,
      requiresTenant: true,
      modulo: 'metricas',
    },
    {
      id: 'pacientes',
      label: 'Pacientes',
      description: 'Historias clínicas, propietarios y seguimiento operativo.',
      path: '/pacientes',
      icon: 'pacientes',
      roles: ['admin_veterinaria'],
      status: 'active',
      category: 'clinical',
      priority: 35,
      showInNavbar: false,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'pacientes',
    },
    {
      id: 'agenda',
      label: 'Agenda',
      description: 'Citas del día, seguimiento y atención programada.',
      path: '/agenda',
      icon: 'agenda',
      roles: ['admin_veterinaria'],
      status: 'active',
      category: 'clinical',
      priority: 40,
      showInNavbar: false,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'agenda',
    },
    {
      id: 'vacunas',
      label: 'Vacunas',
      description: 'Próximas dosis, vencimientos y seguimiento por paciente.',
      path: '/vacunas',
      icon: 'vacunas',
      roles: ['admin_veterinaria'],
      status: 'active',
      category: 'clinical',
      priority: 50,
      showInNavbar: false,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'vacunas',
    },
    {
      id: 'brigadas',
      label: 'Brigadas',
      description: 'Jornadas clínicas y atenciones agrupadas.',
      path: '/brigadas',
      icon: 'brigadas',
      roles: ['admin_veterinaria'],
      status: 'active',
      category: 'operations',
      priority: 60,
      showInNavbar: false,
      showInDashboard: true,
      requiresTenant: true,
      modulo: 'brigadas',
    },
    {
      id: 'suscripcion',
      label: 'Plan/Suscripción',
      description: 'Consumo, cupos y estado del plan heredado o propio.',
      path: '/suscripcion',
      icon: 'suscripcion',
      roles: ['admin_veterinaria'],
      status: 'active',
      category: 'billing',
      priority: 130,
      showInNavbar: true,
      showInDashboard: true,
      requiresTenant: false,
      requiresPlanOwner: true,
      modulo: 'planes',
      badge: 'Plan',
    },
  ],
};

// Filtra el catálogo del dueño-veterinario por superficie (navbar o dashboard) y por
// las reglas de visibilidad que dependen del perfil (p. ej. la suscripción solo si el
// usuario puede verla). Mantiene el orden de declaración del catálogo.
function adminVetModules(
  profile: RbacProfileLike | null | undefined,
  mode: AdminVetMode | undefined,
  surface: 'navbar' | 'dashboard',
): RoleModule[] {
  const catalog = ADMIN_VET_CATALOG[mode === 'veterinario' ? 'veterinario' : 'admin'];
  return catalog.filter((module) => {
    const visibleEnSuperficie = surface === 'navbar' ? module.showInNavbar : module.showInDashboard;
    if (!visibleEnSuperficie) return false;
    if (module.id === 'suscripcion') return puedeVerSuscripcion(profile);
    return true;
  });
}

export function getNavbarItemsForProfile(
  profile: RbacProfileLike | null | undefined,
  mode?: AdminVetMode,
): RoleModule[] {
  if (effectiveRole(profile) === 'admin_veterinaria') {
    return adminVetModules(profile, mode, 'navbar');
  }
  return navItemsForProfile(profile);
}

export function getNavbarItemsForRole(rol: Rol | null | undefined): RoleModule[] {
  return navItemsForRole(rol);
}

export function getDashboardModulesForProfile(
  profile: RbacProfileLike | null | undefined,
  mode?: AdminVetMode,
): RoleModule[] {
  if (effectiveRole(profile) === 'admin_veterinaria') {
    return adminVetModules(profile, mode, 'dashboard');
  }
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
    return rol === 'admin_entidad' || rol === 'superadmin' || rol === 'admin_veterinaria';
  }
  return false;
}
