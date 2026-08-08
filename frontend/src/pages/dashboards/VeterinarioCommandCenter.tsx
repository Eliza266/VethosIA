import React from 'react';
import { useTourGuide } from '../../hooks/useTourGuide';
import type { RbacProfileLike } from '../../lib/rbac';
import type { Veterinario } from '../../types';
import { MetricsPanel } from '../../features/metricas/MetricsPanel';
import { CommandCenterShell } from './CommandCenterShared';

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
  // Un admin_veterinaria/admin_entidad que cambio al modo "Veterinario" sigue siendo
  // admin en sus claims reales: sin forzar el filtro a su propio uid, veria las
  // metricas de toda la clinica en vez de solo las suyas.
  const esAdminEnModoVeterinario = rol === 'admin_veterinaria' || rol === 'admin_entidad';

  return (
    <CommandCenterShell testId="veterinario-command-center" data-tour="inicio-panel">
      <MetricsPanel
        rol={esAdminEnModoVeterinario ? 'veterinario' : rol}
        veterinarioIdForzado={esAdminEnModoVeterinario ? user?.uid : undefined}
      />
    </CommandCenterShell>
  );
};

export default VeterinarioCommandCenter;
export { VeterinarioCommandCenter };
