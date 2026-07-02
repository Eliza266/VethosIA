import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Calendar, ClipboardList, Users } from 'lucide-react';
import { BusinessOverview } from '../../features/saas/BusinessOverview';
import { listarCitasProximas2h } from '../../features/citas/api';
import { obtenerMetricas } from '../../features/metricas/api';
import { usePacientes } from '../../hooks/usePacientes';
import { useAdminVetMode } from '../../hooks/useAdminVetMode';
import { getDashboardModulesForProfile } from '../../lib/roleNavigation';
import type { RbacProfileLike } from '../../lib/rbac';
import {
  CommandCenterShell,
  CommandHero,
  InsightPanel,
  ModuleGrid,
  PrimaryLink,
  StatStrip,
} from './CommandCenterShared';

interface AdminVeterinariaCommandCenterProps {
  me?: RbacProfileLike & { nombre?: string | null; organizacionNombre?: string | null };
}

const AdminVeterinariaCommandCenter: React.FC<AdminVeterinariaCommandCenterProps> = ({ me }) => {
  const { pacientes, loading } = usePacientes();
  const metricas = useQuery({
    queryKey: ['metricas-dashboard'],
    queryFn: () => obtenerMetricas(),
  });
  const citasProximas = useQuery({
    queryKey: ['citas-proximas-2h'],
    queryFn: listarCitasProximas2h,
  });
  const { mode } = useAdminVetMode();
  const modules = getDashboardModulesForProfile(me ?? null, mode);
  const clinicalModules = modules.filter((module) => module.category === 'clinical' || module.category === 'operations');
  const managementModules = modules.filter((module) => module.category === 'tenant' || module.category === 'billing');

  return (
    <CommandCenterShell testId="admin-veterinaria-command-center">
      <CommandHero
        variant="clinic"
        eyebrow="Operación de Clínica"
        title="Control de sede, equipo clínico y capacidad operativa."
        description="Una vista gerencial para coordinar agenda, pacientes de la veterinaria, brigadas, invitaciones y consumo sin entrar al flujo individual como veterinario."
        action={
          <>
            <PrimaryLink to="/veterinaria" icon={<Users className="h-4 w-4" />}>
              Mi veterinaria
            </PrimaryLink>
            <PrimaryLink to="/suscripcion" icon={<Activity className="h-4 w-4" />}>
              Consumo y plan
            </PrimaryLink>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: 'Pacientes sede', value: loading ? '...' : pacientes.length, hint: 'Dentro del scope veterinaria', tone: 'accent' },
          { label: 'Consultas', value: metricas.data?.consultas ?? 0, hint: `${metricas.data?.consultasAprobadas ?? 0} aprobadas`, tone: 'success' },
          { label: 'Agenda', value: citasProximas.data?.length ?? 0, hint: 'Citas próximas 2h', tone: 'info' },
          { label: 'SOAP periodo', value: `${metricas.data?.soapUsados ?? 0}/${metricas.data?.soapLimite ?? 0}`, hint: 'Consumo de sede', tone: 'warn' },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.9fr]">
        <InsightPanel
          title="Estado de la clínica"
          description="Señales operativas para gerencia de sede."
          action={<Link to="/veterinaria" className="text-sm font-black text-[var(--accent)]">Gestionar equipo</Link>}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Equipo clínico</p>
              <p className="mt-1 text-sm text-slate-600">Veterinarios, invitaciones y solicitudes técnicas se gestionan desde la ficha de la veterinaria.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Brigadas</p>
              <p className="mt-1 text-sm text-slate-600">Jornadas disponibles para la sede y su equipo clínico.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Vacunas</p>
              <p className="mt-1 text-sm text-slate-600">{metricas.data?.vacunasVencidas ?? 0} vencidas, {metricas.data?.vacunasProximas ?? 0} próximas.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Diagnósticos</p>
              <p className="mt-1 text-sm text-slate-600">{metricas.data?.topDiagnosticos?.[0]?.nombre ?? 'Sin diagnósticos destacados'}.</p>
            </div>
          </div>
        </InsightPanel>

        <BusinessOverview rol={me?.role ?? me?.rol ?? null} compact profile={me ?? null} />
      </div>

      <ModuleGrid
        title="Operación clínica de sede"
        description="Accesos clínicos y operativos habilitados para Admin Veterinaria."
        modules={clinicalModules}
      />
      <ModuleGrid
        title="Gestión y plan"
        description="Perfil de veterinaria, equipo, consumo e información de suscripción según el scope."
        modules={managementModules}
      />

      <InsightPanel title="Acciones gerenciales" description="Atajos seguros para operar la sede sin acciones incompletas.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Link to="/agenda" className="premium-card premium-card-hover p-4">
            <Calendar className="h-5 w-5 text-[var(--accent)]" />
            <p className="mt-3 text-sm font-black text-slate-900">Agenda de sede</p>
            <p className="mt-1 text-xs text-slate-500">Coordina citas y capacidad diaria.</p>
          </Link>
          <Link to="/pacientes" className="premium-card premium-card-hover p-4">
            <ClipboardList className="h-5 w-5 text-[var(--accent)]" />
            <p className="mt-3 text-sm font-black text-slate-900">Pacientes de sede</p>
            <p className="mt-1 text-xs text-slate-500">Historias dentro del scope veterinaria.</p>
          </Link>
          <Link to="/brigadas" className="premium-card premium-card-hover p-4">
            <Activity className="h-5 w-5 text-[var(--accent)]" />
            <p className="mt-3 text-sm font-black text-slate-900">Brigadas</p>
            <p className="mt-1 text-xs text-slate-500">Jornadas asignadas a la sede.</p>
          </Link>
        </div>
      </InsightPanel>
    </CommandCenterShell>
  );
};

export default AdminVeterinariaCommandCenter;
export { AdminVeterinariaCommandCenter };
