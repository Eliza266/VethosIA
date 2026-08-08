import React from 'react';
import { useTourGuide } from '../../hooks/useTourGuide';
import type { RbacProfileLike } from '../../lib/rbac';
import type { Veterinario } from '../../types';
import { MetricsPanel } from '../../features/metricas/MetricsPanel';
import { CommandCenterShell } from './CommandCenterShared';
import { DashboardWelcome } from './DashboardWelcome';

interface VeterinarioCommandCenterProps {
  me?: RbacProfileLike & { nombre?: string | null; email?: string | null };
  user: Veterinario | null;
}

const TOUR_STEPS_INICIO = [
  { element: '[data-tour="inicio-panel"]', popover: { title: 'Tu panel principal', description: 'Este es tu panel principal: métricas de tu actividad clínica (consultas, pacientes, diagnósticos, vacunación).' } },
];

const VeterinarioCommandCenter: React.FC<VeterinarioCommandCenterProps> = ({ me, user }) => {
  useTourGuide('inicio', TOUR_STEPS_INICIO);
  const rol = me?.role ?? me?.rol ?? null;

  return (
    <CommandCenterShell testId="veterinario-command-center" data-tour="inicio-panel">
      <DashboardWelcome nombre={user?.nombre} email={user?.email} veterinaria={user?.veterinaria} />
      <MetricsPanel rol={rol} />
    </CommandCenterShell>
  );
};

export default VeterinarioCommandCenter;
export { VeterinarioCommandCenter };
