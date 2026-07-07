import { Home, Users, Calendar, Syringe, Activity, Building2 } from 'lucide-react';
import type { ComponentType } from 'react';

export interface SubModule {
  id: string;
  label: string;
  // Vet: cambia de vista via ?tab= (queda una sola pantalla, varias sub-vistas).
  tabValue?: string;
  // Admin: hace scroll a una seccion dentro de la misma pagina (#ancla), no cambia de vista.
  anchor?: string;
}

export interface ModuleConfig {
  id: string;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  subModules: SubModule[];
}

export const VET_NAVIGATION: ModuleConfig[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    path: '/',
    icon: Home,
    subModules: [],
  },
  {
    id: 'pacientes',
    label: 'Pacientes',
    path: '/pacientes',
    icon: Users,
    subModules: [
      { id: 'listar', label: 'Listar', tabValue: 'listar' },
      { id: 'metricas', label: 'Métricas', tabValue: 'metricas' },
    ],
  },
  {
    id: 'agenda',
    label: 'Agenda',
    path: '/agenda',
    icon: Calendar,
    subModules: [
      { id: 'calendario', label: 'Calendario', tabValue: 'calendario' },
      { id: 'metricas', label: 'Métricas', tabValue: 'metricas' },
    ],
  },
  {
    id: 'vacunas',
    label: 'Vacunas',
    path: '/vacunas',
    icon: Syringe,
    subModules: [
      { id: 'control', label: 'Control', tabValue: 'control' },
      { id: 'metricas', label: 'Métricas', tabValue: 'metricas' },
    ],
  },
  {
    id: 'brigadas',
    label: 'Brigadas',
    path: '/brigadas',
    icon: Activity,
    subModules: [
      { id: 'listar', label: 'Listar', tabValue: 'listar' },
      { id: 'metricas', label: 'Métricas', tabValue: 'metricas' },
    ],
  },
];

// Sub-navegación de Admin Veterinaria (modo "admin"). "Mi veterinaria" es una sola pagina
// larga con varias secciones; los sub-items hacen scroll a un ancla en vez de cambiar de
// vista (a diferencia de VET_NAVIGATION, que sí cambia de vista via ?tab=).
export const ADMIN_NAVIGATION: ModuleConfig[] = [
  {
    id: 'veterinaria',
    label: 'Mi veterinaria',
    path: '/veterinaria',
    icon: Building2,
    subModules: [
      { id: 'ficha', label: 'Ficha de la clínica', anchor: 'admin-vet-datos' },
      { id: 'equipo', label: 'Equipo clínico', anchor: 'admin-vet-equipo' },
      { id: 'solicitudes', label: 'Solicitudes técnicas', anchor: 'admin-vet-solicitudes' },
      { id: 'catalogo', label: 'Catálogo de vacunas', anchor: 'admin-vet-catalogo' },
    ],
  },
];
