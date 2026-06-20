import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Building2, Map, Users } from 'lucide-react';
import { BusinessOverview } from '../../features/saas/BusinessOverview';
import { obtenerMetricas } from '../../features/metricas/api';
import { formatSedeLabel } from '../../lib/clinicalLabels';
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

interface AdminEntidadCommandCenterProps {
  me?: RbacProfileLike & { nombre?: string | null; organizacionNombre?: string | null };
}

const AdminEntidadCommandCenter: React.FC<AdminEntidadCommandCenterProps> = ({ me }) => {
  const metricas = useQuery({
    queryKey: ['metricas-dashboard'],
    queryFn: () => obtenerMetricas(),
  });
  const modules = getDashboardModulesForProfile(me ?? null);
  const sedes = metricas.data?.consolidadoVeterinarias ?? [];
  const consumoVet = metricas.data?.consumoIaPorVeterinario ?? [];
  const multiSedeModules = modules.filter((module) => module.category === 'tenant' || module.category === 'operations');
  const billingModules = modules.filter((module) => module.category === 'billing');

  return (
    <CommandCenterShell testId="admin-entidad-command-center">
      <CommandHero
        variant="entity"
        eyebrow="Operación multi-sede"
        title="Gestiona sedes, veterinarios, brigadas y consumo maestro."
        description="Consola para entidades con varias veterinarias o profesionales vinculados. Separa resumen, sedes, consumo y usuarios sin mezclar formularios planos."
        action={
          <>
            <PrimaryLink to="/entidad" icon={<Building2 className="h-4 w-4" />}>
              Vista entidad
            </PrimaryLink>
            <PrimaryLink to="/brigadas" icon={<Activity className="h-4 w-4" />}>
              Brigadas
            </PrimaryLink>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: 'Sedes', value: sedes.length, hint: 'Veterinarias bajo entidad', tone: 'accent' },
          { label: 'Veterinarios', value: consumoVet.length, hint: 'Con consumo registrado', tone: 'info' },
          { label: 'Consultas', value: metricas.data?.consultas ?? 0, hint: `${metricas.data?.consultasAprobadas ?? 0} aprobadas`, tone: 'success' },
          { label: 'SOAP maestro', value: `${metricas.data?.soapUsados ?? 0}/${metricas.data?.soapLimite ?? 0}`, hint: 'Consumo consolidado', tone: 'warn' },
        ]}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.9fr]">
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

        <BusinessOverview rol={me?.role ?? me?.rol ?? null} compact profile={me ?? null} />
      </div>

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

      <InsightPanel title="Sedes y consumo por sede" description="Resumen operativo de sedes propias, sin mezclar por orgId legacy.">
        {sedes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            No hay consolidado de sedes disponible para este contexto.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {sedes.slice(0, 6).map((sede) => (
              <div key={sede.veterinariaId} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-black text-slate-900">{formatSedeLabel(sede.veterinariaId)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {sede.pacientes} pacientes, {sede.consultas} consultas, {sede.soapGenerados} SOAP.
                </p>
                <p className="mt-2 text-xs font-bold text-amber-700">{sede.vacunasVencidas} vacunas vencidas</p>
              </div>
            ))}
          </div>
        )}
      </InsightPanel>
    </CommandCenterShell>
  );
};

export default AdminEntidadCommandCenter;
export { AdminEntidadCommandCenter };
