import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, CreditCard, ShieldCheck } from 'lucide-react';
import { MetricsPanel } from '../../features/metricas/MetricsPanel';
import { getDashboardModulesForProfile, getModuleStatusLabel } from '../../lib/roleNavigation';
import type { RbacProfileLike } from '../../lib/rbac';
import { CommandCenterShell, InsightPanel, ModuleGrid } from './CommandCenterShared';

interface SuperAdminCommandCenterProps {
  me?: RbacProfileLike & { nombre?: string | null };
}

const SuperAdminCommandCenter: React.FC<SuperAdminCommandCenterProps> = ({ me }) => {
  const rol = me?.role ?? me?.rol ?? null;
  const modules = getDashboardModulesForProfile(me ?? null);
  const platformModules = modules.filter((module) => module.category === 'platform' || module.category === 'support');
  const billingModules = modules.filter((module) => module.category === 'billing');
  const pendingModules = modules.filter((module) => module.status === 'pending' || module.status === 'configurable');

  return (
    <CommandCenterShell testId="superadmin-command-center">
      <MetricsPanel rol={rol} />

      <ModuleGrid
        title="Gestión centralizada"
        description="Entidades, veterinarias, miembros, auditoría y configuración desde soporte plataforma."
        modules={platformModules}
      />
      <ModuleGrid
        title="Planes, suscripciones y cobros"
        description="Wompi productivo no se activa aquí; los módulos no listos quedan como operación administrada."
        modules={billingModules}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.85fr]">
        <InsightPanel title="Estados de plataforma" description="Módulo no activo no significa pantalla rota. Cada estado queda explicitado.">
          <div className="space-y-3">
            {pendingModules.map((module) => (
              <div key={module.id} className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                <p className="text-sm font-black text-slate-950">{module.label}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-amber-700">
                  {getModuleStatusLabel(module)}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
              </div>
            ))}
          </div>
        </InsightPanel>

        <InsightPanel title="Sistema interno" description="Jobs y automatizaciones siguen protegidos por backend/internal guard.">
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <Activity className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-3 text-sm font-black text-slate-900">Jobs/sistema</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Capacidad interna oculta de navegación pública. No se ejecutan jobs reales desde este dashboard.
              </p>
            </div>
            <Link to="/auditoria" className="premium-card premium-card-hover block p-4">
              <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-3 text-sm font-black text-slate-900">Auditoría</p>
              <p className="mt-1 text-xs text-slate-500">Ruta controlada para trazabilidad global.</p>
            </Link>
            <Link to="/suscripciones" className="premium-card premium-card-hover block p-4">
              <CreditCard className="h-5 w-5 text-[var(--accent)]" />
              <p className="mt-3 text-sm font-black text-slate-900">Suscripciones</p>
              <p className="mt-1 text-xs text-slate-500">Operación administrada desde soporte plataforma.</p>
            </Link>
          </div>
        </InsightPanel>
      </div>
    </CommandCenterShell>
  );
};

export default SuperAdminCommandCenter;
export { SuperAdminCommandCenter };
