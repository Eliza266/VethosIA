import React, { useMemo, useState } from 'react';
import { useTourGuide } from '../hooks/useTourGuide';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { CalendarClock, CalendarDays, CheckCircle2, Link2, Plus, Users, X, Save, TrendingUp, AlertTriangle } from 'lucide-react';
import { useCitas } from '../features/citas/hooks';
import {
  motivoCita,
  sugerirPacientePorTitulo,
  type Cita,
} from '../features/citas/api';
import { usePacientes } from '../hooks/usePacientes';
import { Card, Button, Badge, Skeleton, EmptyState, KpiCard, SectionHeader, PageHeader } from '../components/ui/Primitives';

const CalendarioCitas = React.lazy(() => import('../features/citas/CalendarioCitas'));

const ESTADO_LABEL: Record<Cita['estado'], string> = {
  programada: 'Programada',
  en_atencion: 'En atención',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
};

const inputClasses =
  'w-full min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--text)] outline-none transition-all placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]';

const TOUR_STEPS_AGENDA = [
  { element: '[data-tour="agenda-calendario"]', popover: { title: 'Calendario', description: 'Aquí ves tu calendario de citas, tipo Google Calendar. Cambia entre vista de mes, semana o día; en celular arranca en vista de día para que se lea mejor.' } },
  { element: '[data-tour="agenda-nueva-cita"]', popover: { title: 'Nueva cita', description: 'Haz clic en un espacio vacío para crear una cita nueva. Puedes vincularla a un paciente existente y, el día de la cita, abrirla directo hacia la consulta.' } },
];

const Agenda: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useTourGuide('agenda', TOUR_STEPS_AGENDA);
  const { data, isLoading, crear, cambiarEstado, vincularPaciente } = useCitas();
  const { pacientes } = usePacientes();

  const currentTab = new URLSearchParams(location.search).get('tab') || 'calendario';

  const [subTab, setSubTab] = useState<'calendario' | 'citas_dia'>('calendario');
  const [selectedCita, setSelectedCita] = useState<Cita | null>(null);

  // Modal State for new appointment
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCita, setNewCita] = useState({
    pacienteId: '',
    motivo: '',
    fecha: '',
  });

  const [vinculoManual, setVinculoManual] = useState<Record<string, string>>({});

  const toDatetimeLocal = (date: Date): string => {
    const pad = (num: number) => String(num).padStart(2, '0');
    const yyyy = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
  };

  const handleSelectSlot = (start: Date) => {
    setNewCita({
      pacienteId: '',
      motivo: '',
      fecha: toDatetimeLocal(start),
    });
    setIsModalOpen(true);
  };

  const formatHora = (fechaIso: string) => {
    try {
      const d = new Date(fechaIso);
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'n/d';
    }
  };

  // Today's appointments
  const hoyCitas = useMemo(() => {
    const todayStr = new Date().toDateString();
    return (data ?? []).filter(c => new Date(c.fecha).toDateString() === todayStr);
  }, [data]);

  const citasProgramadas = (data ?? []).filter((c) => c.estado === 'programada').length;
  const citasVinculadas = (data ?? []).filter((c) => Boolean(c.pacienteId)).length;
  const citasAtendidas = (data ?? []).filter((c) => c.estado === 'realizada' || Boolean(c.consultaId)).length;

  const atender = async (cita: Cita) => {
    if (!cita.pacienteId) return;
    await cambiarEstado.mutateAsync({ id: cita.id, estado: 'en_atencion' });
    setSelectedCita(null);
    navigate(`/pacientes/${cita.pacienteId}/consultas/nueva?citaId=${cita.id}`);
  };

  const renderAcciones = (c: Cita) => {
    if (c.consultaId && c.pacienteId) {
      return (
        <Link to={`/pacientes/${c.pacienteId}/consultas/${c.consultaId}`} onClick={() => setSelectedCita(null)}>
          <Button variant="ghost">Abrir consulta</Button>
        </Link>
      );
    }
    if (c.pacienteId && (c.estado === 'programada' || c.estado === 'en_atencion')) {
      return (
        <Button variant="primary" onClick={() => void atender(c)}>
          Atender / Crear consulta
        </Button>
      );
    }
    if (!c.pacienteId) {
      const sugerido = sugerirPacientePorTitulo(c.titulo, pacientes);
      const seleccion = vinculoManual[c.id] ?? sugerido?.id ?? '';
      return (
        <span className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
            <Link2 className="h-3.5 w-3.5" />
            Paciente no vinculado
          </span>
          <select
            aria-label="Vincular paciente"
            value={seleccion}
            onChange={(e) => setVinculoManual((m) => ({ ...m, [c.id]: e.target.value }))}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-accent/12"
          >
            <option value="">Seleccionar paciente…</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {sugerido?.id === p.id ? ' (sugerido)' : ''}
              </option>
            ))}
          </select>
          {seleccion && (
            <Button
              variant="ghost"
              disabled={vincularPaciente.isPending}
              onClick={() => {
                vincularPaciente.mutate(
                  { id: c.id, pacienteId: seleccion },
                  { onSuccess: () => setSelectedCita(null) }
                );
              }}
            >
              Vincular
            </Button>
          )}
        </span>
      );
    }
    return null;
  };

  const handleCreateCita = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCita.pacienteId || !newCita.motivo || !newCita.fecha) return;
    crear.mutate({
      pacienteId: newCita.pacienteId,
      motivo: newCita.motivo,
      fecha: new Date(newCita.fecha).toISOString(),
    });
    setNewCita({ pacienteId: '', motivo: '', fecha: '' });
    setIsModalOpen(false);
  };

  // Calculate real metrics
  const totalCitas = data?.length ?? 0;
  const programadasCount = data?.filter((c) => c.estado === 'programada').length ?? 0;
  const enAtencionCount = data?.filter((c) => c.estado === 'en_atencion').length ?? 0;
  const realizadasCount = data?.filter((c) => c.estado === 'realizada').length ?? 0;
  const canceladasCount = data?.filter((c) => c.estado === 'cancelada').length ?? 0;
  const noAsistioCount = data?.filter((c) => c.estado === 'no_asistio').length ?? 0;

  const totalCerradas = realizadasCount + noAsistioCount;
  const asistenciaPct = totalCerradas ? Math.round((realizadasCount / totalCerradas) * 100) : 100;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 animate-fade-in py-4">
      
      <PageHeader
        badge="Operación clínica"
        title="Agenda Médica"
        description="Planifica citas, vincula pacientes y abre la consulta clínica."
        action={
          <Button variant="primary" onClick={() => setIsModalOpen(true)} className="rounded-xl" data-tour="agenda-nueva-cita">
            <Plus className="h-4 w-4" />
            Nueva Cita
          </Button>
        }
      />

      {currentTab === 'metricas' ? (
        /* Real Metrics Dashboard view */
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              label="Total de Citas"
              value={totalCitas}
              hint="Histórico de citas gestionadas"
              icon={<CalendarDays className="h-5 w-5" />}
              accent="info"
            />
            <KpiCard
              label="Tasa de Asistencia"
              value={`${asistenciaPct}%`}
              hint={`${realizadasCount} asistidas de ${totalCerradas} cerradas`}
              icon={<TrendingUp className="h-5 w-5" />}
              accent="success"
            />
            <KpiCard
              label="Citas Canceladas / No asistió"
              value={canceladasCount + noAsistioCount}
              hint={`${canceladasCount} canceladas · ${noAsistioCount} ausentes`}
              icon={<AlertTriangle className="h-5 w-5" />}
              accent="danger"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card padding="lg">
              <SectionHeader
                title="Distribución de Estados"
                description="Estado actual de todas las citas agendadas."
              />
              <div className="mt-6 space-y-4">
                {[
                  { label: 'Programadas', count: programadasCount, color: 'bg-blue-500' },
                  { label: 'En atención', count: enAtencionCount, color: 'bg-amber-500' },
                  { label: 'Realizadas', count: realizadasCount, color: 'bg-emerald-500' },
                  { label: 'Canceladas', count: canceladasCount, color: 'bg-slate-400' },
                  { label: 'No asistió', count: noAsistioCount, color: 'bg-red-500' },
                ].map((item) => {
                  const pct = totalCitas ? Math.round((item.count / totalCitas) * 100) : 0;
                  return (
                    <div key={item.label} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span>{item.label}</span>
                        <span>{item.count} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card padding="lg">
              <SectionHeader
                title="Eficiencia de la Agenda"
                description="Métricas operativas del flujo de consultas."
              />
              <div className="mt-6 space-y-6">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tasa de Ausentismo</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Las citas marcadas como "No asistió" o "Cancelada" representan tiempo clínico desaprovechado. Recomendamos enviar confirmaciones automáticas de citas 24h antes para optimizar el flujo.
                  </p>
                </div>
                <div className="flex items-center justify-between p-4 bg-accent/5 border border-accent/10 rounded-2xl">
                  <div>
                    <h5 className="text-xs font-extrabold text-accent uppercase tracking-wider">Citas del día programadas</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">Pendientes de atención hoy</p>
                  </div>
                  <span className="text-lg font-black text-accent bg-white px-3 py-1 rounded-xl shadow-sm border border-accent/10">
                    {hoyCitas.filter(c => c.estado === 'programada').length}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* Default Calendar View */
        <>
          {/* Level 2 Sub-Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setSubTab('calendario')}
              className={`px-6 py-3 font-bold text-sm border-b-2 transition-all ${
                subTab === 'calendario'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Calendario
            </button>
            <button
              onClick={() => setSubTab('citas_dia')}
              className={`px-6 py-3 font-bold text-sm border-b-2 transition-all ${
                subTab === 'citas_dia'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Citas del día ({hoyCitas.length})
            </button>
          </div>

          {/* Conditional View Rendering */}
          {subTab === 'calendario' ? (
            <div className="space-y-6">
              
              {/* KPI Dashboard */}
              <div className="grid gap-4 md:grid-cols-3">
                <KpiCard
                  label="Citas visibles"
                  value={totalCitas}
                  hint={`${citasProgramadas} programadas`}
                  icon={<CalendarDays className="h-5 w-5" />}
                  accent="info"
                />
                <KpiCard
                  label="Pacientes vinculados"
                  value={`${citasVinculadas}/${totalCitas || 0}`}
                  hint="Listas para abrir consulta"
                  icon={<Users className="h-5 w-5" />}
                  accent="success"
                />
                <KpiCard
                  label="Atención cerrada"
                  value={citasAtendidas}
                  hint="Consulta creada o realizada"
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  accent="warn"
                />
              </div>

              {isLoading ? (
                <div className="grid gap-3">
                  <Skeleton height={60} />
                  <Skeleton height={60} />
                  <Skeleton height={60} />
                </div>
              ) : (
                <div data-tour="agenda-calendario">
                  <React.Suspense fallback={
                    <div className="grid gap-3">
                      <Skeleton height={60} />
                      <Skeleton height={60} />
                      <Skeleton height={60} />
                    </div>
                  }>
                    <CalendarioCitas
                      citas={data ?? []}
                      onSelectCita={(cita) => setSelectedCita(cita)}
                      onSelectSlot={handleSelectSlot}
                    />
                  </React.Suspense>
                </div>
              )}
            </div>
          ) : (
            /* Citas del Día view */
            <Card padding="lg">
              <div className="flex justify-between items-center mb-6">
                <SectionHeader
                  title="Citas para el día de hoy"
                  description="Flujo de atenciones planificadas para hoy."
                />
              </div>

              {hoyCitas.length === 0 ? (
                <EmptyState
                  titulo="Sin citas para hoy"
                  mensaje="No tienes atenciones agendadas para el día de hoy."
                  icon={<CheckCircle2 className="h-6 w-6" />}
                />
              ) : (
                <div className="grid gap-3">
                  {hoyCitas.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white border border-slate-200/80 rounded-2xl shadow-[0_2px_8px_-3px_rgba(15,23,42,0.05)] hover:border-accent/30 transition-all duration-200"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-accent/5 text-accent rounded-xl shrink-0 mt-0.5">
                          <CalendarClock className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-slate-800 text-sm">{c.pacienteNombre ?? c.titulo}</strong>
                            <Badge estado={c.estado}>{ESTADO_LABEL[c.estado] || c.estado}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                            <span>🕒 {formatHora(c.fecha)}</span>
                            <span>•</span>
                            <span>📝 {c.motivo ?? c.titulo}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end md:self-center">
                        {renderAcciones(c)}
                        {c.estado !== 'realizada' && c.estado !== 'cancelada' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cambiarEstado.mutate({ id: c.id, estado: 'realizada' })}
                          >
                            Marcar realizada
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* New Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-fade-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h2 className="text-lg font-extrabold text-slate-800">Nueva Cita Médica</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCita} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Mascota / Paciente
                </label>
                <select
                  required
                  aria-label="Paciente"
                  value={newCita.pacienteId}
                  onChange={(e) => setNewCita({ ...newCita, pacienteId: e.target.value })}
                  className={inputClasses}
                >
                  <option value="">Selecciona una mascota…</option>
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} ({p.propietario?.nombre ?? 'Sin propietario'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Motivo de la Cita
                </label>
                <input
                  required
                  aria-label="Motivo de la cita"
                  placeholder="Ej. Control post-operatorio, vacunación"
                  value={newCita.motivo}
                  onChange={(e) => setNewCita({ ...newCita, motivo: e.target.value })}
                  className={inputClasses}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Fecha y Hora
                </label>
                <input
                  required
                  aria-label="Fecha y hora"
                  type="datetime-local"
                  value={newCita.fecha}
                  onChange={(e) => setNewCita({ ...newCita, fecha: e.target.value })}
                  className={inputClasses}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 text-sm font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold text-white bg-accent hover:bg-accent-strong rounded-xl transition-all shadow-md shadow-accent/15"
                >
                  <Save className="h-4 w-4" />
                  Agendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cita Detail / Actions Modal */}
      {selectedCita && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-fade-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Detalle de la Cita</span>
                <h2 className="text-lg font-extrabold text-slate-800">{selectedCita.pacienteNombre ?? selectedCita.titulo}</h2>
              </div>
              <button
                onClick={() => setSelectedCita(null)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <p>
                <strong>Estado: </strong>
                <Badge estado={selectedCita.estado}>{ESTADO_LABEL[selectedCita.estado] || selectedCita.estado}</Badge>
              </p>
              <p><strong>Fecha y Hora:</strong> {new Date(selectedCita.fecha).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}</p>
              <p><strong>Motivo:</strong> {motivoCita(selectedCita)}</p>
              {selectedCita.notas && <p><strong>Notas:</strong> {selectedCita.notas}</p>}
            </div>

            <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {renderAcciones(selectedCita)}
              </div>
              
              {selectedCita.estado !== 'realizada' && selectedCita.estado !== 'cancelada' && (
                <div className="flex gap-2 w-full mt-2">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={async () => {
                      await cambiarEstado.mutateAsync({ id: selectedCita.id, estado: 'realizada' });
                      setSelectedCita(null);
                    }}
                  >
                    Marcar realizada
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={async () => {
                      await cambiarEstado.mutateAsync({ id: selectedCita.id, estado: 'cancelada' });
                      setSelectedCita(null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;
export { Agenda };
