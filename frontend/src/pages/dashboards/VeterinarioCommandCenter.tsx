import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useTourGuide } from '../../hooks/useTourGuide';
import TourHelpButton from '../../components/TourHelpButton';
import { Link } from 'react-router-dom';
import { FileText, Mic, Plus, Search, Calendar, ChevronRight } from 'lucide-react';
import { listarCitas, type Cita as CitaApi } from '../../features/citas/api';
import { useConsultas } from '../../hooks/useConsultas';
import { usePacientes } from '../../hooks/usePacientes';
import { useAdminVetMode } from '../../hooks/useAdminVetMode';
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
import type { Cita, Consulta, Veterinario } from '../../types';
import { EmptyState } from '../../components/ui/Primitives';
import { CommandCenterShell, InsightPanel } from './CommandCenterShared';

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

const getSpeciesEmoji = (esp?: string) => {
  switch (esp) {
    case 'perro': return '🐶';
    case 'gato': return '🐱';
    case 'ave': return '🦜';
    case 'reptil': return '🦎';
    default: return '🐾';
  }
};

const pickModules = (modules: RoleModule[], ids: string[]) =>
  ids.map((id) => modules.find((module) => module.id === id)).filter((module): module is RoleModule => !!module);

const CompactConsultaAction: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link
    to={to}
    className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-accent transition-colors hover:bg-slate-50"
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
    <article className="py-4 border-b border-slate-100 last:border-b-0" data-testid={`consulta-reciente-${consulta.id}`}>
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

const TOUR_STEPS_INICIO = [
  { element: '[data-tour="inicio-panel"]', popover: { title: 'Tu panel principal', description: 'Este es tu panel principal. Aquí ves un resumen rápido de tu día: consultas recientes, pacientes atendidos y tus próximas citas de agenda.' } },
  { element: '[data-tour="inicio-nueva-consulta"]', popover: { title: 'Nueva consulta', description: 'Elige un paciente e inicia la grabación en un clic. Si no quieres buscar la mascota antes, usa "Consulta rápida" desde la pantalla de Pacientes.' } },
];

const VeterinarioCommandCenter: React.FC<VeterinarioCommandCenterProps> = ({ me, user }) => {
  const { pacientes } = usePacientes();
  const { fetchTodasConsultas } = useConsultas();
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [citasHoy, setCitasHoy] = useState<Cita[]>([]);

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
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
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [fetchTodasConsultas, pacientes]);

  const nombre = displayUserLabel({ nombre: me?.nombre ?? user?.nombre, email: me?.email ?? user?.email });
  const { mode } = useAdminVetMode();
  const { replay } = useTourGuide('inicio', TOUR_STEPS_INICIO);
  const modules = getDashboardModulesForProfile(me ?? null, mode);
  const primaryModules = pickModules(modules, PRIMARY_MODULE_IDS);
  const secondaryModules = pickModules(modules, SECONDARY_MODULE_IDS);

  const resolveHref = useCallback(
    (module: RoleModule) => resolveModulePath(module.id, module.path, consultas),
    [consultas],
  );

  const getPatientName = (pacienteId: string) =>
    formatClinicalName(pacientes.find((p) => p.id === pacienteId)?.nombre, 'Paciente');

  // Combined modules for a single line quick access strip
  const allModules = useMemo(() => {
    return [...primaryModules, ...secondaryModules];
  }, [primaryModules, secondaryModules]);

  // Patients search logic
  const filteredPacientes = useMemo(() => {
    if (!searchTerm.trim()) return pacientes.slice(0, 5);
    const q = searchTerm.toLowerCase();
    return pacientes.filter(
      p =>
        p.nombre.toLowerCase().includes(q) ||
        (p.propietario?.nombre || '').toLowerCase().includes(q)
    );
  }, [pacientes, searchTerm]);

  return (
    <CommandCenterShell testId="veterinario-command-center" data-tour="inicio-panel">
      {/* Compact header — replaces the old green banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider text-accent">Centro clínico</span>
          <h1 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">Hola, {nombre}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            to="/pacientes"
            data-tour="inicio-nueva-consulta"
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-accent/10 hover:bg-accent-strong transition-all hover:scale-[1.01]"
          >
            <Mic className="h-4 w-4" />
            Nueva consulta
          </Link>
          <Link
            to="/pacientes/nuevo"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Plus className="h-4 w-4" />
            Nuevo paciente
          </Link>
        </div>
      </div>

      {/* Quick access strip */}
      <div className="space-y-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prioridad clínica</h2>
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {allModules.map((module) => {
            const href = resolveHref(module);
            return (
              <Link
                key={module.id}
                to={href}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/70 hover:bg-slate-50 border border-slate-100 hover:border-accent/30 rounded-xl transition-all shrink-0 font-bold text-xs text-slate-700"
              >
                <span>{module.label === 'Pacientes' ? '🐾' : module.label === 'Agenda' ? '📅' : module.label === 'Vacunas' ? '💉' : '✨'}</span>
                <span>{module.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Patient search */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Buscador de Pacientes</h3>
            <p className="text-xs text-slate-400">Busca expedientes clínicos o selecciona de la lista de pacientes recientes.</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o dueño..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none transition-all"
            />
          </div>
        </div>

        {filteredPacientes.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4 text-center">No se encontraron pacientes que coincidan.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {filteredPacientes.map((p) => (
              <Link
                key={p.id}
                to={`/pacientes/${p.id}`}
                className="flex items-center gap-3 p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 hover:border-accent/30 rounded-xl transition-all"
              >
                <span className="text-2xl">{getSpeciesEmoji(p.especie)}</span>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 truncate">{p.nombre}</h4>
                  <p className="text-[10px] text-slate-400 truncate capitalize">{p.raza || p.especie}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Consultas & Citas panels */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <InsightPanel
          title="Historial clínico de consultas"
          description="Últimas consultas clínicas realizadas con el borrador SOAP e historial."
          action={<Link to="/pacientes" className="text-xs font-bold text-accent hover:underline flex items-center">Ver todos <ChevronRight className="h-3 w-3" /></Link>}
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

        <InsightPanel
          title="Próximas citas"
          description="Atenciones programadas para el día de hoy."
          action={<Link to="/agenda" className="text-xs font-bold text-accent hover:underline flex items-center">Ver agenda <ChevronRight className="h-3 w-3" /></Link>}
        >
          <div className="space-y-3">
            {citasHoy.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                No hay citas programadas para hoy.
              </div>
            ) : (
              citasHoy.slice(0, 4).map((cita) => (
                <div key={cita.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 hover:bg-slate-50 transition-all flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {formatClinicalName(cita.nombrePaciente, 'Paciente')}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">{cita.motivo}</p>
                  </div>
                  <span className="text-[10px] font-black text-accent bg-accent/5 px-2 py-1 rounded-lg shrink-0">
                    {cita.horaInicio}
                  </span>
                </div>
              ))
            )}
          </div>
        </InsightPanel>
      </div>
      <TourHelpButton onReplay={replay} />
    </CommandCenterShell>
  );
};

export default VeterinarioCommandCenter;
export { VeterinarioCommandCenter };
