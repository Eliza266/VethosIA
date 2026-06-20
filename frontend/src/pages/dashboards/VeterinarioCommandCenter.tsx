import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Mic, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { listarCitas, listarCitasProximas2h, type Cita as CitaApi } from '../../features/citas/api';
import { obtenerMetricas } from '../../features/metricas/api';
import { resumenVacunasPendientes } from '../../features/vacunas/api';
import { useConsultas } from '../../hooks/useConsultas';
import { usePacientes } from '../../hooks/usePacientes';
import { displayUserLabel } from '../../lib/displayUser';
import {
  consultaDetailPath,
  consultaDocumentPath,
  isConsultaAprobada,
  resolveModulePath,
} from '../../lib/clinicalDocuments';
import {
  formatClinicalDateTime,
  formatClinicalName,
  formatConsultaEstado,
} from '../../lib/clinicalLabels';
import { getDashboardModulesForProfile } from '../../lib/roleNavigation';
import type { RbacProfileLike, RoleModule } from '../../lib/rbac';
import type { Cita, Consulta, Paciente, Veterinario } from '../../types';
import { EmptyState } from '../../components/ui/Primitives';
import {
  CommandCenterShell,
  CommandHero,
  InsightPanel,
  ModuleGrid,
  PrimaryLink,
  StatStrip,
} from './CommandCenterShared';

interface VeterinarioCommandCenterProps {
  me?: RbacProfileLike & { nombre?: string | null; email?: string | null };
  user: Veterinario | null;
}

const PRIMARY_MODULE_IDS = ['nueva-consulta', 'consulta-soap', 'pacientes'];
const SECONDARY_MODULE_IDS = ['agenda', 'vacunas', 'brigadas', 'nuevo-paciente'];

const fechaDiaLocal = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const horaDesdeIso = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const mapCitaApi = (c: CitaApi, nombrePaciente: string): Cita => ({
  id: c.id,
  pacienteId: c.pacienteId ?? '',
  nombrePaciente: c.pacienteNombre ?? nombrePaciente,
  veterinarioId: '',
  fecha: fechaDiaLocal(c.fecha),
  horaInicio: horaDesdeIso(c.fecha),
  duracion: 30,
  motivo: c.motivo ?? c.titulo,
  estado: c.estado,
  consultaId: c.consultaId,
  creadoEn: new Date(),
});

const getSpeciesLabel = (esp: string) => {
  switch (esp) {
    case 'perro':
      return 'Perro';
    case 'gato':
      return 'Gato';
    case 'ave':
      return 'Ave';
    case 'reptil':
      return 'Reptil';
    default:
      return 'Mascota';
  }
};

const pickModules = (modules: RoleModule[], ids: string[]) =>
  ids.map((id) => modules.find((module) => module.id === id)).filter((module): module is RoleModule => !!module);

const CompactConsultaAction: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link
    to={to}
    className="inline-flex shrink-0 items-center rounded-full border border-[color-mix(in_srgb,var(--accent)_18%,var(--border))] bg-white px-3 py-1.5 text-xs font-bold text-[var(--accent)] transition-colors hover:bg-[var(--accent-soft)]"
  >
    {children}
  </Link>
);

const ConsultaRecienteRow: React.FC<{
  consulta: Consulta;
  patientName: string;
}> = ({ consulta, patientName }) => {
  const aprobada = isConsultaAprobada(consulta);
  const detallePath = consultaDetailPath(consulta);

  return (
    <article className="py-4" data-testid={`consulta-reciente-${consulta.id}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Link to={detallePath} className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-900">{patientName}</p>
          <p className="mt-0.5 text-xs text-slate-500">{formatClinicalDateTime(consulta.fechaHora)}</p>
        </Link>
        <span
          className={`inline-flex shrink-0 self-start rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
            aprobada ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {formatConsultaEstado(consulta.estado)}
        </span>
      </div>
      {aprobada ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <CompactConsultaAction to={detallePath}>Ver SOAP</CompactConsultaAction>
          <CompactConsultaAction to={consultaDocumentPath(consulta, 'pdf')}>PDF</CompactConsultaAction>
          <CompactConsultaAction to={consultaDocumentPath(consulta, 'email')}>Email demo</CompactConsultaAction>
          <CompactConsultaAction to={consultaDocumentPath(consulta, 'whatsapp')}>WhatsApp seguro</CompactConsultaAction>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Documentos disponibles después de aprobación clínica.
        </p>
      )}
    </article>
  );
};

const VeterinarioCommandCenter: React.FC<VeterinarioCommandCenterProps> = ({ me, user }) => {
  const { pacientes, loading: loadingPacientes } = usePacientes();
  const { fetchTodasConsultas } = useConsultas();
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [citasHoy, setCitasHoy] = useState<Cita[]>([]);
  const [loadingClinico, setLoadingClinico] = useState(true);

  const vacunas = useQuery({
    queryKey: ['vacunas-pendientes'],
    queryFn: resumenVacunasPendientes,
  });
  const metricas = useQuery({
    queryKey: ['metricas-dashboard'],
    queryFn: () => obtenerMetricas(),
  });
  const citasProximas2h = useQuery({
    queryKey: ['citas-proximas-2h'],
    queryFn: listarCitasProximas2h,
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoadingClinico(true);
      try {
        const [consultaList, apiCitas] = await Promise.all([fetchTodasConsultas(), listarCitas()]);
        if (!alive) return;
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const citas = apiCitas
          .filter((c) => fechaDiaLocal(c.fecha) === todayStr)
          .map((c) =>
            mapCitaApi(
              c,
              c.pacienteId ? (pacientes.find((p) => p.id === c.pacienteId)?.nombre ?? c.titulo) : c.titulo,
            ),
          )
          .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
        setConsultas(consultaList ?? []);
        setCitasHoy(citas);
      } catch {
        if (!alive) return;
        setConsultas([]);
        setCitasHoy([]);
      } finally {
        if (alive) setLoadingClinico(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [fetchTodasConsultas, pacientes]);

  const nombre = displayUserLabel({ nombre: me?.nombre ?? user?.nombre, email: me?.email ?? user?.email });
  const modules = getDashboardModulesForProfile(me ?? null);
  const primaryModules = pickModules(modules, PRIMARY_MODULE_IDS);
  const secondaryModules = pickModules(modules, SECONDARY_MODULE_IDS);
  const consultasAprobadas = consultas.filter((c) => isConsultaAprobada(c)).length;
  const pendientesVacunas = (vacunas.data?.proximas ?? 0) + (vacunas.data?.vencidas ?? 0);
  const loading = loadingPacientes || loadingClinico;

  const resolveHref = useCallback(
    (module: RoleModule) => resolveModulePath(module.id, module.path, consultas),
    [consultas],
  );

  const getPatientName = (pacienteId: string) =>
    formatClinicalName(pacientes.find((p) => p.id === pacienteId)?.nombre, 'Paciente');

  const getPatientSpecies = (pacienteId: string): Paciente['especie'] =>
    pacientes.find((p) => p.id === pacienteId)?.especie ?? 'otro';

  return (
    <CommandCenterShell testId="veterinario-command-center">
      <CommandHero
        variant="clinical"
        eyebrow="Centro clínico"
        title={`Hola, ${nombre}. Empieza por una consulta, el SOAP o tus pacientes.`}
        description="Prioriza atención clínica y revisión SOAP. PDF, email demo y WhatsApp seguro son acciones documentales controladas, no módulos independientes."
        action={
          <>
            <PrimaryLink to="/pacientes" icon={<Mic className="h-4 w-4" />}>
              Nueva consulta
            </PrimaryLink>
            <PrimaryLink to="/pacientes/nuevo" icon={<Plus className="h-4 w-4" />}>
              Nuevo paciente
            </PrimaryLink>
          </>
        }
      />

      <StatStrip
        stats={[
          { label: 'Pacientes', value: loading ? '...' : pacientes.length, hint: 'Expedientes activos', tone: 'accent' },
          { label: 'Consultas', value: loading ? '...' : consultas.length, hint: `${consultasAprobadas} con SOAP aprobado`, tone: 'success' },
          { label: 'Citas hoy', value: loading ? '...' : citasHoy.length, hint: `${citasProximas2h.data?.length ?? 0} próximas 2 h`, tone: 'info' },
          { label: 'Vacunas', value: pendientesVacunas, hint: `${vacunas.data?.vencidas ?? 0} vencidas`, tone: pendientesVacunas > 0 ? 'warn' : 'success' },
        ]}
      />

      <ModuleGrid
        title="Prioridad clínica"
        description="Lo primero del día: iniciar consulta, revisar SOAP y abrir expedientes."
        modules={primaryModules}
        variant="primary"
        resolveHref={resolveHref}
      />

      <ModuleGrid
        title="Operación diaria"
        description="Agenda, vacunas, brigadas y registro de pacientes como soporte secundario."
        modules={secondaryModules}
        variant="secondary"
        resolveHref={resolveHref}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <InsightPanel
          title="Consultas recientes"
          description="Acciones documentales compactas disponibles solo en consultas con SOAP aprobado."
          action={<Link to="/pacientes" className="text-sm font-black text-[var(--accent)]">Ver pacientes</Link>}
        >
          {consultas.length === 0 ? (
            <EmptyState
              titulo="Sin consultas registradas"
              mensaje="Inicia una consulta desde un paciente para generar borrador SOAP."
              icon={<FileText className="h-6 w-6" />}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {consultas.slice(0, 5).map((consulta) => (
                <ConsultaRecienteRow
                  key={consulta.id}
                  consulta={consulta}
                  patientName={getPatientName(consulta.pacienteId)}
                />
              ))}
            </div>
          )}
        </InsightPanel>

        <InsightPanel title="Agenda y alertas" description="Atenciones del día, vacunas y consumo clínico.">
          <div className="space-y-3">
            {citasHoy.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No hay citas programadas para hoy.
              </div>
            ) : (
              citasHoy.slice(0, 4).map((cita) => (
                <div key={cita.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black text-slate-900">
                    {cita.horaInicio} · {formatClinicalName(cita.nombrePaciente, 'Paciente')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{cita.motivo}</p>
                </div>
              ))
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-400">Consumo SOAP</p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {metricas.data?.soapUsados ?? 0}/{metricas.data?.soapLimite ?? 0}
              </p>
            </div>
            {pacientes.slice(0, 3).map((paciente) => (
              <Link key={paciente.id} to={`/pacientes/${paciente.id ?? ''}`} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                <span className="text-sm font-bold text-slate-800">{formatClinicalName(paciente.nombre, 'Paciente')}</span>
                <span className="text-xs text-slate-500">{getSpeciesLabel(getPatientSpecies(paciente.id ?? ''))}</span>
              </Link>
            ))}
          </div>
        </InsightPanel>
      </div>
    </CommandCenterShell>
  );
};

export default VeterinarioCommandCenter;
export { VeterinarioCommandCenter };
