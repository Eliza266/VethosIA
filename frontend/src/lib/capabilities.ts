export type CapabilityRole =
  | 'superadmin'
  | 'admin_entidad'
  | 'admin_veterinaria'
  | 'veterinario';

export type InternalCapabilityRole = CapabilityRole | 'sistema';

export type CapabilityStatus = 'active' | 'readonly' | 'configurable' | 'pending' | 'hidden';

export type CapabilityCategory =
  | 'clinical'
  | 'operations'
  | 'tenant'
  | 'platform'
  | 'billing'
  | 'support'
  | 'internal';

export type CapabilityIcon =
  | 'dashboard'
  | 'pacientes'
  | 'agenda'
  | 'vacunas'
  | 'brigadas'
  | 'nuevo'
  | 'entidad'
  | 'veterinaria'
  | 'suscripcion'
  | 'soporte'
  | 'configuracion';

export type CapabilityAccessModulo =
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

export interface CapabilityModule {
  id: string;
  label: string;
  description: string;
  path: string;
  icon: CapabilityIcon;
  roles: readonly CapabilityRole[];
  internalRoles?: readonly InternalCapabilityRole[];
  status: CapabilityStatus;
  category: CapabilityCategory;
  priority: number;
  showInNavbar: boolean;
  showInDashboard: boolean;
  requiresTenant: boolean;
  requiresPlanOwner?: boolean;
  rbacModulo: CapabilityAccessModulo;
  badge?: string;
}

export const DASHBOARD_CAPABILITY: CapabilityModule = {
  id: 'dashboard',
  label: 'Dashboard',
  description: 'Inicio operativo por rol.',
  path: '/',
  icon: 'dashboard',
  roles: ['superadmin', 'admin_entidad', 'admin_veterinaria', 'veterinario'],
  status: 'active',
  category: 'operations',
  priority: 0,
  showInNavbar: true,
  showInDashboard: false,
  requiresTenant: false,
  rbacModulo: 'notificaciones',
};

export const ROLE_CAPABILITY_MODULES: readonly CapabilityModule[] = [
  {
    id: 'soporte',
    label: 'Soporte plataforma',
    description: 'Operación global, planes, pagos, auditoría y solicitudes de plataforma.',
    path: '/admin',
    icon: 'soporte',
    roles: ['superadmin'],
    status: 'active',
    category: 'platform',
    priority: 10,
    showInNavbar: true,
    showInDashboard: true,
    requiresTenant: false,
    rbacModulo: 'soporte',
    badge: 'Global',
  },
  {
    id: 'entidades-global',
    label: 'Entidades',
    description: 'Gestión centralizada de entidades y su estructura operativa.',
    path: '/admin',
    icon: 'entidad',
    roles: ['superadmin'],
    status: 'readonly',
    category: 'platform',
    priority: 20,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: false,
    rbacModulo: 'entidades',
  },
  {
    id: 'veterinarias-global',
    label: 'Veterinarias',
    description: 'Sedes y clínicas administradas desde soporte plataforma.',
    path: '/admin',
    icon: 'veterinaria',
    roles: ['superadmin'],
    status: 'readonly',
    category: 'platform',
    priority: 30,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: false,
    rbacModulo: 'veterinarias',
  },
  {
    id: 'usuarios-miembros',
    label: 'Usuarios y miembros',
    description: 'Administración de miembros por soporte, sin operar como tenant clínico.',
    path: '/admin',
    icon: 'soporte',
    roles: ['superadmin'],
    status: 'readonly',
    category: 'platform',
    priority: 40,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: false,
    rbacModulo: 'veterinarios',
  },
  {
    id: 'planes-globales',
    label: 'Planes',
    description: 'Catalogo y seguimiento de planes administrado por soporte.',
    path: '/planes',
    icon: 'suscripcion',
    roles: ['superadmin'],
    status: 'configurable',
    category: 'billing',
    priority: 50,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: false,
    rbacModulo: 'planes',
    badge: 'Gestión centralizada',
  },
  {
    id: 'suscripciones-globales',
    label: 'Suscripciones',
    description: 'Seguimiento global de suscripciones desde soporte plataforma.',
    path: '/suscripciones',
    icon: 'suscripcion',
    roles: ['superadmin'],
    status: 'configurable',
    category: 'billing',
    priority: 60,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: false,
    rbacModulo: 'planes',
  },
  {
    id: 'pagos-cobros',
    label: 'Pagos y cobros',
    description: 'Módulo preparado para conciliación operativa; Wompi productivo queda fuera de esta fase.',
    path: '/admin',
    icon: 'suscripcion',
    roles: ['superadmin'],
    status: 'pending',
    category: 'billing',
    priority: 70,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: false,
    rbacModulo: 'planes',
    badge: 'Configuración pendiente',
  },
  {
    id: 'auditoria-global',
    label: 'Auditoría',
    description: 'Revisión global controlada de eventos y acciones de plataforma.',
    path: '/auditoria',
    icon: 'soporte',
    roles: ['superadmin'],
    status: 'configurable',
    category: 'support',
    priority: 80,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: false,
    rbacModulo: 'auditoria',
  },
  {
    id: 'configuracion-global',
    label: 'Configuración',
    description: 'Ajustes globales protegidos, sin activar integraciones reales en esta fase.',
    path: '/configuracion',
    icon: 'soporte',
    roles: ['superadmin'],
    status: 'configurable',
    category: 'platform',
    priority: 90,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: false,
    rbacModulo: 'configuracion',
  },
  {
    id: 'sistema-jobs',
    label: 'Sistema y jobs',
    description: 'Capacidad interna protegida; no se expone como navegacion publica.',
    path: '/admin',
    icon: 'soporte',
    roles: ['superadmin'],
    internalRoles: ['sistema'],
    status: 'hidden',
    category: 'internal',
    priority: 100,
    showInNavbar: false,
    showInDashboard: false,
    requiresTenant: false,
    rbacModulo: 'configuracion',
  },
  {
    id: 'entidad',
    label: 'Vista entidad',
    description: 'Gestión consolidada de sedes, equipos, consumo y métricas.',
    path: '/entidad',
    icon: 'entidad',
    roles: ['admin_entidad'],
    status: 'active',
    category: 'tenant',
    priority: 10,
    showInNavbar: true,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'entidades',
    badge: 'Entidad',
  },
  {
    id: 'sedes-entidad',
    label: 'Sedes',
    description: 'Veterinarias y equipos vinculados a la entidad.',
    path: '/entidad',
    icon: 'entidad',
    roles: ['admin_entidad'],
    status: 'active',
    category: 'tenant',
    priority: 20,
    showInNavbar: true,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'veterinarias',
    badge: 'Entidad',
  },
  {
    id: 'veterinarios-por-sede',
    label: 'Veterinarios por sede',
    description: 'Equipo clínico agrupado por veterinaria dentro de la entidad.',
    path: '/entidad',
    icon: 'entidad',
    roles: ['admin_entidad'],
    status: 'active',
    category: 'tenant',
    priority: 30,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'veterinarios',
  },
  {
    id: 'freelancers-entidad',
    label: 'Freelancers',
    description: 'Veterinarios freelance vinculados directamente a la entidad cuando el modelo lo soporta.',
    path: '/entidad',
    icon: 'entidad',
    roles: ['admin_entidad'],
    status: 'readonly',
    category: 'tenant',
    priority: 40,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'veterinarios',
  },
  {
    id: 'consumo-entidad',
    label: 'Consumo consolidado',
    description: 'Uso agregado de sedes propias y veterinarios freelance directos.',
    path: '/suscripcion',
    icon: 'suscripcion',
    roles: ['admin_entidad'],
    status: 'active',
    category: 'billing',
    priority: 50,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: true,
    requiresPlanOwner: true,
    rbacModulo: 'consumo',
  },
  {
    id: 'cobertura-territorial',
    label: 'Cobertura territorial',
    description: 'Modulo preparado para cobertura operativa; mapas avanzados quedan fuera de esta fase.',
    path: '/entidad',
    icon: 'entidad',
    roles: ['admin_entidad'],
    status: 'pending',
    category: 'operations',
    priority: 70,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'metricas',
    badge: 'Configuración pendiente',
  },
  {
    id: 'veterinarias',
    label: 'Veterinarias',
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
    rbacModulo: 'veterinarias',
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
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'equipo',
  },
  {
    id: 'pacientes',
    label: 'Pacientes',
    description: 'Historias clínicas, propietarios y seguimiento operativo.',
    path: '/pacientes',
    icon: 'pacientes',
    roles: ['admin_veterinaria', 'veterinario'],
    status: 'active',
    category: 'clinical',
    priority: 30,
    showInNavbar: true,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'pacientes',
  },
  {
    id: 'agenda',
    label: 'Agenda',
    description: 'Citas del día, seguimiento y atención programada.',
    path: '/agenda',
    icon: 'agenda',
    roles: ['admin_veterinaria', 'veterinario'],
    status: 'active',
    category: 'clinical',
    priority: 40,
    showInNavbar: true,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'agenda',
  },
  {
    id: 'vacunas',
    label: 'Vacunas',
    description: 'Próximas dosis, vencimientos y seguimiento por paciente.',
    path: '/vacunas',
    icon: 'vacunas',
    roles: ['admin_veterinaria', 'veterinario'],
    status: 'active',
    category: 'clinical',
    priority: 50,
    showInNavbar: true,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'vacunas',
  },
  {
    id: 'brigadas',
    label: 'Brigadas',
    description: 'Jornadas clínicas y atenciones agrupadas.',
    path: '/brigadas',
    icon: 'brigadas',
    roles: ['admin_entidad', 'admin_veterinaria', 'veterinario'],
    status: 'active',
    category: 'operations',
    priority: 60,
    showInNavbar: true,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'brigadas',
  },
  {
    id: 'nueva-consulta',
    label: 'Nueva consulta',
    description: 'Graba de una vez; busca un paciente existente o deja que la IA detecte los datos del audio.',
    path: '/consultas/nueva-rapida',
    icon: 'nuevo',
    roles: ['admin_veterinaria', 'veterinario'],
    status: 'active',
    category: 'clinical',
    priority: 70,
    showInNavbar: true,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'consultaIA',
    badge: 'Clínico',
  },
  {
    id: 'consulta-soap',
    label: 'Consulta SOAP',
    description: 'Borrador, aprobación clínica, historia y revisión de nota estructurada.',
    path: '/pacientes',
    icon: 'nuevo',
    roles: ['admin_veterinaria', 'veterinario'],
    status: 'active',
    category: 'clinical',
    priority: 80,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'consultaIA',
  },
  {
    id: 'nuevo-paciente',
    label: 'Nuevo paciente',
    description: 'Registro operativo de pacientes dentro de la cuenta.',
    path: '/pacientes/nuevo',
    icon: 'nuevo',
    roles: ['admin_veterinaria', 'veterinario'],
    status: 'active',
    category: 'clinical',
    priority: 90,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'pacientes',
  },
  {
    id: 'pdf-clinico',
    label: 'PDF clínico',
    description: 'Generación disponible después de aprobación clínica. Requiere consulta aprobada.',
    path: '/pacientes',
    icon: 'nuevo',
    roles: ['admin_veterinaria', 'veterinario'],
    status: 'readonly',
    category: 'clinical',
    priority: 100,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'pdf',
  },
  {
    id: 'email-demo',
    label: 'Email demo',
    description: 'Salida controlada en modo demo asociada a consulta aprobada; proveedor real no se activa.',
    path: '/pacientes',
    icon: 'nuevo',
    roles: ['admin_veterinaria', 'veterinario'],
    status: 'readonly',
    category: 'clinical',
    priority: 110,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'notificaciones',
  },
  {
    id: 'whatsapp-link',
    label: 'WhatsApp seguro',
    description: 'Enlace controlado asociado a consulta aprobada; API real de WhatsApp queda fuera de esta fase.',
    path: '/pacientes',
    icon: 'nuevo',
    roles: ['admin_veterinaria', 'veterinario'],
    status: 'readonly',
    category: 'clinical',
    priority: 120,
    showInNavbar: false,
    showInDashboard: true,
    requiresTenant: true,
    rbacModulo: 'notificaciones',
  },
  {
    id: 'suscripcion',
    label: 'Suscripción',
    description: 'Consumo, cupos y estado del plan heredado o propio.',
    path: '/suscripcion',
    icon: 'suscripcion',
    roles: ['admin_entidad', 'admin_veterinaria'],
    status: 'active',
    category: 'billing',
    priority: 130,
    showInNavbar: true,
    showInDashboard: true,
    requiresTenant: false,
    requiresPlanOwner: true,
    rbacModulo: 'planes',
    badge: 'Plan',
  },
  {
    id: 'perfil',
    label: 'Perfil',
    description: 'Datos del usuario autenticado y configuración personal segura.',
    path: '/perfil',
    icon: 'dashboard',
    roles: ['admin_entidad', 'admin_veterinaria', 'veterinario', 'superadmin'],
    status: 'active',
    category: 'operations',
    priority: 900,
    showInNavbar: false,
    showInDashboard: false,
    requiresTenant: false,
    rbacModulo: 'notificaciones',
  },
  {
    id: 'ajustes',
    label: 'Configuración',
    description: 'Tu perfil y preferencias personales.',
    path: '/ajustes',
    icon: 'configuracion',
    roles: ['veterinario'],
    status: 'active',
    category: 'operations',
    priority: 910,
    showInNavbar: true,
    showInDashboard: false,
    requiresTenant: false,
    rbacModulo: 'configuracion',
  },
];

export const MODULE_STATUS_LABEL: Record<CapabilityStatus, string> = {
  active: 'Activo',
  readonly: 'Solo lectura',
  configurable: 'Gestión centralizada',
  pending: 'Configuración pendiente',
  hidden: 'Interno',
};

export function findCapabilityModule(id: string): CapabilityModule | undefined {
  if (id === DASHBOARD_CAPABILITY.id) return DASHBOARD_CAPABILITY;
  return ROLE_CAPABILITY_MODULES.find((module) => module.id === id);
}

export function capabilitiesForRole(role: CapabilityRole | null | undefined): CapabilityModule[] {
  if (!role) return [];
  return ROLE_CAPABILITY_MODULES.filter((module) => module.roles.includes(role))
    .slice()
    .sort((a, b) => a.priority - b.priority);
}

export function navbarCapabilitiesForRole(role: CapabilityRole | null | undefined): CapabilityModule[] {
  if (!role) return [];
  return [
    DASHBOARD_CAPABILITY,
    ...capabilitiesForRole(role).filter(
      (module) => module.showInNavbar && module.status !== 'hidden',
    ),
  ];
}

export function dashboardCapabilitiesForRole(role: CapabilityRole | null | undefined): CapabilityModule[] {
  return capabilitiesForRole(role).filter(
    (module) => module.showInDashboard && module.status !== 'hidden',
  );
}
