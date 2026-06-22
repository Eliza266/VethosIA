import { Home, Users, Calendar, Syringe, Activity } from 'lucide-react';
import type { ComponentType } from 'react';

export interface SubModule {
  id: string;
  label: string;
  tabValue: string;
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
