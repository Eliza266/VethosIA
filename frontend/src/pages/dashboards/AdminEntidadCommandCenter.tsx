import React from 'react';
import { Link } from 'react-router-dom';
import { Map, Users } from 'lucide-react';
import { MetricsPanel } from '../../features/metricas/MetricsPanel';
import { getDashboardModulesForProfile } from '../../lib/roleNavigation';
import type { RbacProfileLike } from '../../lib/rbac';
import { CommandCenterShell, InsightPanel, ModuleGrid } from './CommandCenterShared';

interface AdminEntidadCommandCenterProps {
  me?: RbacProfileLike & { nombre?: string | null; organizacionNombre?: string | null };
}

const AdminEntidadCommandCenter: React.FC<AdminEntidadCommandCenterProps> = ({ me }) => {
  const rol = me?.role ?? me?.rol ?? null;
  const modules = getDashboardModulesForProfile(me ?? null);
  const multiSedeModules = modules.filter((module) => module.category === 'tenant' || module.category === 'operations');
  const billingModules = modules.filter((module) => module.category === 'billing');

  return (
    <CommandCenterShell testId="admin-entidad-command-center">
      <MetricsPanel rol={rol} />

      <InsightPanel
        title="Resumen territorial"
        description="Cobertura y freelancers directos como capacidades preparadas, sin pantallas rotas ni mapas avanzados."
        action={<Link to="/entidad" className="text-sm font-black text-[var(--accent)]">Abrir consola entidad</Link>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <Map className="h-5 w-5 text-[var(--accent)]" />
            <p className="mt-3 text-sm font-black text-slate-900">Cobertura territorial</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Configuración pendiente; se presenta como módulo preparado, no como error de producto.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <Users className="h-5 w-5 text-[var(--accent)]" />
            <p className="mt-3 text-sm font-black text-slate-900">Freelancers directos</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Lectura segura cuando el modelo V2 trae vínculos directos a entidad.</p>
          </div>
        </div>
      </InsightPanel>

      <ModuleGrid
        title="Sedes y operación"
        description="Sedes, veterinarios, brigadas, métricas y cobertura según capacidades del rol."
        modules={multiSedeModules}
      />
      <ModuleGrid
        title="Plan maestro y consumo"
        description="Suscripción maestra y consumo consolidado de sedes propias y freelancers directos."
        modules={billingModules}
      />
    </CommandCenterShell>
  );
};

export default AdminEntidadCommandCenter;
export { AdminEntidadCommandCenter };
