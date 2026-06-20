import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, CreditCard, Settings, ShieldCheck } from 'lucide-react';
import { obtenerMetricas } from '../../features/metricas/api';
import { getDashboardModulesForProfile, getModuleStatusLabel } from '../../lib/roleNavigation';
import type { RbacProfileLike } from '../../lib/rbac';
import {
  CommandCenterShell,
  CommandHero,
  InsightPanel,
  ModuleGrid,
  PrimaryLink,
  StatStrip,
} from './CommandCenterShared';

interface SuperAdminCommandCenterProps {
  me?: RbacProfileLike & { nombre?: string | null };
}

const SuperAdminCommandCenter: React.FC<SuperAdminCommandCenterProps> = ({ me }) => {
  const metricas = useQuery({
    queryKey: ['metricas-dashboard'],
    queryFn: () => obtenerMetricas(),
    retry: false,
  });
  const modules = getDashboardModulesForProfile(me ?? null);
  const platformModules = modules.filter((module) => module.category === 'platform' || module.category === 'support');
  const billingModules = modules.filter((module) => module.category === 'billing');
  const pendingModules = modules.filter((module) => module.status === 'pending' || module.status === 'configurable');

  return (
    <CommandCenterShell testId="superadmin-command-center">
      <CommandHero
        variant="platform"
        eyebrow="Operación Plataforma"
        title="Soporte global sin operar como tenant clínico."
        description="Panel para administrar entidades, veterinarias, usuarios, planes, suscripciones, auditoría y configuración. Las integraciones no activas se muestran como estados premium, no como placeholders rotos."
        action={
          <>
            <PrimaryLink to="/admin" icon={<ShieldCheck className="h-4 w-4" />}>
              Soporte plataforma
            </PrimaryLink>
            <PrimaryLink to="/configuracion" icon={<Settings className="h-4 w-4" />}>
              Configuración
            </PrimaryLink>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: 'Módulos globales', value: modules.length, hint: 'Capacidades visibles', tone: 'accent' },
          { label: 'Configurables', value: pendingModules.length, hint: 'Pendientes o listos para habilitar', tone: 'warn' },
          { label: 'Consultas globales', value: metricas.data?.consultas ?? 0, hint: 'Lectura de plataforma', tone: 'info' },
          { label: 'Auditoría', value: 'Activa', hint: 'Ruta controlada', tone: 'success' },
        ]}
      />

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
