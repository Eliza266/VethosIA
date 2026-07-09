import { Home, Users, Calendar, Syringe, Activity, Building2, Settings } from 'lucide-react';
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
  {
    id: 'ajustes',
    label: 'Configuración',
    path: '/ajustes',
    icon: Settings,
    subModules: [],
  },
];

// Sub-navegación de Admin Veterinaria (modo "admin"). "Configuración" es un hub de
// tarjetas que cambia de sub-vista via ?tab= (mismo patron que VET_NAVIGATION), en vez
// del scroll-a-ancla que usaba antes cuando todo vivia en una sola pagina larga.
export const ADMIN_NAVIGATION: ModuleConfig[] = [
  {
    id: 'veterinaria',
    label: 'Configuración',
    path: '/veterinaria',
    icon: Building2,
    subModules: [
      { id: 'ficha', label: 'Ficha de la clínica', tabValue: 'ficha' },
      { id: 'equipo', label: 'Equipo clínico', tabValue: 'equipo' },
      { id: 'catalogo', label: 'Catálogo de vacunas', tabValue: 'catalogo' },
      { id: 'solicitudes', label: 'Solicitudes técnicas', tabValue: 'solicitudes' },
    ],
  },
];
