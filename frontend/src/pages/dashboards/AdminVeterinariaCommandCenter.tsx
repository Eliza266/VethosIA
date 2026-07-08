import React from 'react';
import { useTourGuide } from '../../hooks/useTourGuide';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Calendar, ClipboardList, Mic, Users } from 'lucide-react';
import { BusinessOverview } from '../../features/saas/BusinessOverview';
import { listarCitasProximas2h } from '../../features/citas/api';
import { obtenerMetricas } from '../../features/metricas/api';
import { usePacientes } from '../../hooks/usePacientes';
import type { RbacProfileLike } from '../../lib/rbac';
import {
  CommandCenterShell,
  CommandHero,
  InsightPanel,
  PrimaryLink,
  StatStrip,
} from './CommandCenterShared';

interface AdminVeterinariaCommandCenterProps {
  me?: RbacProfileLike & { nombre?: string | null; organizacionNombre?: string | null };
}

const TOUR_STEPS_ADMIN_VET = [
  { element: '[data-tour="admin-vet-panel"]', popover: { title: 'Tu panel de gerencia', description: 'Un vistazo rápido: pacientes, consultas, agenda y consumo del período. El detalle completo está en "Métricas".' } },
  { element: '[data-tour="admin-vet-nueva-consulta"]', popover: { title: 'Nueva consulta', description: 'Inicia una consulta de una vez, igual que lo haría un veterinario, sin cambiar de panel.' } },
  { element: '[data-tour="admin-vet-mi-veterinaria"]', popover: { title: 'Mi veterinaria', description: 'Gestiona el perfil de tu sede, el equipo clínico (veterinarios vinculados), invitaciones nuevas y solicitudes técnicas pendientes.' } },
  { element: '[data-tour="admin-vet-accesos"]', popover: { title: 'Accesos rápidos', description: 'Atajos directos a Agenda, Pacientes y Brigadas de tu sede, para revisar o coordinar sin perder tiempo navegando el menú.' } },
];

const AdminVeterinariaCommandCenter: React.FC<AdminVeterinariaCommandCenterProps> = ({ me }) => {
  useTourGuide('admin-vet-inicio', TOUR_STEPS_ADMIN_VET);
  const { pacientes, loading } = usePacientes();
  const metricas = useQuery({
    queryKey: ['metricas-dashboard'],
    queryFn: () => obtenerMetricas(),
  });
  const citasProximas = useQuery({
    queryKey: ['citas-proximas-2h'],
    queryFn: listarCitasProximas2h,
  });

  return (
    <CommandCenterShell testId="admin-veterinaria-command-center" data-tour="admin-vet-panel">
      <CommandHero
        variant="clinic"
        eyebrow="Operación de Clínica"
        title="Control de sede, equipo clínico y capacidad operativa."
        description="Una vista gerencial para coordinar agenda, pacientes de la veterinaria, brigadas, invitaciones y consumo sin entrar al flujo individual como veterinario."
        action={
          <>
            <PrimaryLink to="/pacientes" icon={<Mic className="h-4 w-4" />} data-tour="admin-vet-nueva-consulta">
              Nueva consulta
            </PrimaryLink>
            <PrimaryLink to="/veterinaria" icon={<Users className="h-4 w-4" />} data-tour="admin-vet-mi-veterinaria">
              Mi veterinaria
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

      <BusinessOverview rol={me?.role ?? me?.rol ?? null} compact profile={me ?? null} />

      <InsightPanel title="Accesos rápidos" description="Atajos directos a lo que más se usa día a día.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-tour="admin-vet-accesos">
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
