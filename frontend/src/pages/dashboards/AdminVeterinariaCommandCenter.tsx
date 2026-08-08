import React from 'react';
import { useTourGuide } from '../../hooks/useTourGuide';
import { MetricsPanel } from '../../features/metricas/MetricsPanel';
import type { RbacProfileLike } from '../../lib/rbac';
import { CommandCenterShell } from './CommandCenterShared';
import { DashboardWelcome } from './DashboardWelcome';

interface AdminVeterinariaCommandCenterProps {
  me?: RbacProfileLike & {
    nombre?: string | null;
    email?: string | null;
    organizacionNombre?: string | null;
    veterinariaNombre?: string | null;
  };
}

const TOUR_STEPS_ADMIN_VET = [
  { element: '[data-tour="admin-vet-panel"]', popover: { title: 'Tu panel de gerencia', description: 'Métricas de tu sede: pacientes, consultas, agenda y consumo del período.' } },
];

const AdminVeterinariaCommandCenter: React.FC<AdminVeterinariaCommandCenterProps> = ({ me }) => {
  useTourGuide('admin-vet-inicio', TOUR_STEPS_ADMIN_VET);
  const rol = me?.role ?? me?.rol ?? null;

  return (
    <CommandCenterShell testId="admin-veterinaria-command-center" data-tour="admin-vet-panel">
      <DashboardWelcome nombre={me?.nombre} email={me?.email} veterinaria={me?.veterinariaNombre} />
      <MetricsPanel rol={rol} />
    </CommandCenterShell>
  );
};

export default AdminVeterinariaCommandCenter;
export { AdminVeterinariaCommandCenter };
