import {
  LayoutDashboard,
  Users,
  Calendar,
  Syringe,
  Activity,
  PlusCircle,
  Building2,
  ShieldCheck,
  CreditCard,
  Hospital,
  FileClock,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NavIcon } from './rbac';

/** Mapa de iconos para items de navegación basados en RoleModule.icon (string). */
export const NAV_ICON: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  pacientes: Users,
  agenda: Calendar,
  vacunas: Syringe,
  brigadas: Activity,
  nuevo: PlusCircle,
  entidad: Building2,
  veterinaria: Building2,
  suscripcion: CreditCard,
  soporte: ShieldCheck,
};

export interface PlatformItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
}

/** Secciones del superadmin (paridad con la barra global previa). */
export const SUPERADMIN_ITEMS: PlatformItem[] = [
  { id: 'overview', label: 'Dashboard', path: '/admin', icon: ShieldCheck },
  { id: 'entidades', label: 'Entidades', path: '/admin?panel=entidades', icon: Building2 },
  { id: 'veterinarias', label: 'Veterinarias', path: '/admin?panel=veterinarias', icon: Hospital },
  { id: 'usuarios', label: 'Usuarios', path: '/admin?panel=usuarios', icon: Users },
  { id: 'planes', label: 'Planes', path: '/planes', icon: CreditCard },
  { id: 'suscripciones', label: 'Suscripciones', path: '/suscripciones', icon: Activity },
  { id: 'pagos', label: 'Pagos', path: '/admin?panel=pagos', icon: CreditCard },
  { id: 'auditoria', label: 'Auditoría', path: '/auditoria', icon: FileClock },
  { id: 'configuracion', label: 'Configuración', path: '/configuracion', icon: Settings },
];

/** Sección activa del superadmin según ruta + query (paridad con el Navbar). */
export function getSuperAdminActiveSection(pathname: string, search: string): string | null {
  if (pathname === '/planes') return 'planes';
  if (pathname === '/suscripciones') return 'suscripciones';
  if (pathname === '/auditoria') return 'auditoria';
  if (pathname === '/configuracion') return 'configuracion';
  const panel = new URLSearchParams(search).get('panel');
  if (panel === 'entidades' || panel === 'veterinarias' || panel === 'usuarios' || panel === 'pagos') {
    return panel;
  }
  if (pathname === '/admin' || pathname.startsWith('/admin')) return 'overview';
  return null;
}

export function getSpeciesEmoji(esp?: string): string {
  switch (esp) {
    case 'perro':
      return '🐶';
    case 'gato':
      return '🐱';
    case 'ave':
      return '🦜';
    case 'reptil':
      return '🦎';
    default:
      return '🐾';
  }
}
