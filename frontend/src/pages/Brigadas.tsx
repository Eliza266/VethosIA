import React, { useEffect, useMemo, useState } from 'react';
import { useTourGuide } from '../hooks/useTourGuide';
import TourHelpButton from '../components/TourHelpButton';
import { useLocation } from 'react-router-dom';
import { Activity, AlertCircle, Calendar, CheckCircle2, ClipboardList, MapPin, Plus, Stethoscope, Users, X } from 'lucide-react';
import { useBrigadas } from '../hooks/useBrigadas';
import { useMe } from '../features/tenant/hooks';
import { normalizarRol } from '../lib/rbac';
import { getErrorMessage } from '../lib/errors';
import { KpiCard, Card, SectionHeader, PageHeader } from '../components/ui/Primitives';
import type { Brigada, BrigadaAtencion, BrigadaConsolidado } from '../types';
import {
  listarAtencionesBrigada,
  obtenerConsolidadoBrigada,
} from '../features/brigadas/api';
import {
  listarMiembrosBackoffice,
  listarVeterinariasBackoffice,
  type BackofficeMiembro,
  type BackofficeVeterinaria,
} from '../features/backoffice/api';

interface BrigadaForm {
  nombre: string;
  descripcion: string;
  fecha: string;
  direccion: string;
  ciudad: string;
  veterinariaId: string;
  veterinarioIds: string[];
}const EMPTY_FORM: BrigadaForm = {
  nombre: '',
  descripcion: '',
  fecha: '',
  direccion: '',
  ciudad: '',
  veterinariaId: '',
  veterinarioIds: [],
};
const ESTADO_CONFIG = {
  planificada: { label: 'Planificada', classes: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  en_curso: { label: 'En curso', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  finalizada: { label: 'Finalizada', classes: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
};

const TOUR_STEPS_BRIGADAS = [
  { element: '[data-tour="brigadas-lista"]', popover: { title: 'Listado de brigadas', description: 'Las brigadas agrupan las consultas que atiendes en una jornada de campo.' } },
  { element: '[data-tour="brigadas-activa"]', popover: { title: 'Brigada activa', description: 'Actívala antes de empezar a atender, y todas tus consultas del día quedarán asociadas automáticamente.' } },
];

const Brigadas: React.FC = () => {
  const { data: me } = useMe();
  const rol = normalizarRol(me?.role ?? me?.rol ?? null);
  const { brigadas, loading, error, crearBrigada, actualizarBrigada } = useBrigadas();
  const location = useLocation();
  const currentTab = new URLSearchParams(location.search).get('tab') || 'listar';
  const { replay } = useTourGuide('brigadas', TOUR_STEPS_BRIGADAS);

  const [sedes, setSedes] = useState<BackofficeVeterinaria[]>([]);
  const [miembros, setMiembros] = useState<BackofficeMiembro[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Brigada | null>(null);
  const [selected, setSelected] = useState<Brigada | null>(null);
  const [form, setForm] = useState<BrigadaForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [atenciones, setAtenciones] = useState<BrigadaAtencion[]>([]);
  const [consolidado, setConsolidado] = useState<BrigadaConsolidado | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const canManage = rol === 'admin_entidad' || rol === 'admin_veterinaria';
  const canChooseSede = rol === 'admin_entidad';

  useEffect(() => {
    let active = true;
    if (!canManage) {
      setSedes([]);
      setMiembros([]);
      return;
    }
    Promise.all([listarVeterinariasBackoffice(), listarMiembrosBackoffice()])
      .then(([sedesList, miembrosList]) => {
        if (!active) return;
        setSedes(sedesList);
        setMiembros(miembrosList.filter((m) => m.role === 'veterinario' || m.rol === 'vet'));
        setCatalogError(null);
      })
      .catch((err) => {
        if (!active) return;
        setCatalogError(getErrorMessage(err, 'No se pudo cargar sedes o participantes.'));
      });
    return () => {
      active = false;
    };
  }, [canManage]);

  const participantesDisponibles = useMemo(() => {
    if (!form.veterinariaId) return miembros;
    return miembros.filter((m) => m.veterinariaId === form.veterinariaId || m.accountId === form.veterinariaId);
  }, [form.veterinariaId, miembros]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (brigada: Brigada) => {
    setEditing(brigada);
    setForm({
      nombre: brigada.nombre,
      descripcion: brigada.descripcion ?? '',
      fecha: brigada.fecha,
      direccion: brigada.ubicacion.direccion ?? '',
      ciudad: brigada.ubicacion.ciudad ?? '',
      veterinariaId: brigada.veterinariaId ?? '',
      veterinarioIds: brigada.veterinarioIds ?? [],
    });
    setFormError(null);
    setShowModal(true);
  };

  const closeForm = () => {
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const toggleParticipante = (uid: string) => {
    setForm((prev) => ({
      ...prev,
      veterinarioIds: prev.veterinarioIds.includes(uid)
        ? prev.veterinarioIds.filter((id) => id !== uid)
        : [...prev.veterinarioIds, uid],
    }));
  };

  const handleCreateOrEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.nombre.trim() || !form.fecha || !form.ciudad.trim()) {
      setFormError('Nombre, fecha y ciudad son obligatorios.');
      return;
    }
    setSubmitting(true);
    const payload: Omit<Brigada, 'creadoEn'> = {
      ...(editing?.id ? { id: editing.id } : {}),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || undefined,
      fecha: form.fecha,
      ubicacion: { direccion: form.direccion.trim(), ciudad: form.ciudad.trim() },
      veterinariaId: canChooseSede && form.veterinariaId ? form.veterinariaId : undefined,
      veterinarioIds: canManage ? form.veterinarioIds : [],
      estado: editing?.estado ?? 'planificada',
    };
    try {
      if (editing?.id) {
        const ok = await actualizarBrigada(editing.id, payload);
        if (ok) {
          setSelected((prev) => {
            if (!prev || prev.id !== editing.id) return prev;
            return { ...prev, ...payload, creadoEn: prev.creadoEn };
          });
          closeForm();
        }
      } else {
        const id = await crearBrigada(payload);
        if (id) closeForm();
      }
    } catch (err) {
      setFormError(getErrorMessage(err, 'No se pudo guardar la brigada.'));
    } finally {
      setSubmitting(false);
    }
  };

  const loadDetail = async (brigada: Brigada) => {
    setSelected(brigada);
    setDetailError(null);
    setAtenciones([]);
    setConsolidado(null);
    if (!brigada.id) return;
    try {
      const [atts, cons] = await Promise.all([
        listarAtencionesBrigada(brigada.id),
        obtenerConsolidadoBrigada(brigada.id),
      ]);
      setAtenciones(atts);
      setConsolidado(cons);
    } catch (err) {
      setDetailError(getErrorMessage(err, 'No se pudo cargar el detalle de la brigada.'));
    }
  };

  const handleEstado = async (brigada: Brigada, estado: Brigada['estado']) => {
    if (!brigada.id) return;
    const ok = await actualizarBrigada(brigada.id, { estado });
    if (ok) {
      const updated = { ...brigada, estado };
      setSelected(updated);
      setConsolidado((prev) => (prev ? { ...prev, estado } : prev));
    }
  };



  const estadoSiguiente = (brigada: Brigada): Brigada['estado'] | null => {
    if (brigada.estado === 'planificada') return 'en_curso';
    if (brigada.estado === 'en_curso') return 'finalizada';
    return null;
  };

  const brigadasActivas = brigadas.filter((b) => b.estado === 'en_curso').length;
  const brigadasPlanificadas = brigadas.filter((b) => b.estado === 'planificada').length;
  const participantesTotal = brigadas.reduce((total, b) => total + (b.veterinarioIds ?? []).length, 0);
  const gridBrigadasClass =
    brigadas.length === 1
      ? 'grid grid-cols-1 gap-5'
      : 'grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3';

  return (
    <div className="space-y-6 animate-fade-in py-6">
      <PageHeader
        badge="Operación territorial"
        title="Brigadas de Salud"
        description="Jornadas operativas, participantes y atenciones agrupadas por campaña o sede."
        action={
          canManage ? (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-accent/10 hover:bg-accent-strong transition-all hover:scale-[1.01] shrink-0"
            >
              <Plus className="h-4 w-4" />
              Nueva brigada
            </button>
          ) : undefined
        }
      />

      {/* KPI strip — only shown on list view */}
      {currentTab === 'listar' && !selected && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          {[
            ['Jornadas', brigadas.length],
            ['En curso', brigadasActivas],
            ['Planificadas', brigadasPlanificadas],
            ['Participantes', participantesTotal],
          ].map(([label, value]) => (
            <div key={String(label)} className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
              <strong className="mt-1 block text-2xl font-black text-slate-800">{value}</strong>
            </div>
          ))}
        </div>
      )}

      {currentTab === 'metricas' ? (
        /* Real Metrics Dashboard view */
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              label="Total de Brigadas"
              value={brigadas.length}
              hint="Jornadas territoriales registradas"
              icon={<Users className="h-5 w-5" />}
              accent="info"
            />
            <KpiCard
              label="Brigadas En Curso"
              value={brigadasActivas}
              hint="Jornadas operando actualmente"
              icon={<Activity className="h-5 w-5" />}
              accent="success"
            />
            <KpiCard
              label="Participantes Totales"
              value={participantesTotal}
              hint="Veterinarios asignados a brigadas"
              icon={<Stethoscope className="h-5 w-5" />}
              accent="warn"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card padding="lg">
              <SectionHeader
                title="Consolidado Operativo"
                description="Distribución de brigadas territoriales por estado de ejecución."
              />
              <div className="mt-6 space-y-4">
                {[
                  { label: 'Planificadas', count: brigadasPlanificadas, color: 'bg-blue-500' },
                  { label: 'En curso', count: brigadasActivas, color: 'bg-emerald-500' },
                  { label: 'Finalizadas', count: brigadas.filter(b => b.estado === 'finalizada').length, color: 'bg-slate-400' },
                ].map((item) => {
                  const pct = brigadas.length ? Math.round((item.count / brigadas.length) * 100) : 0;
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
                title="Monitoreo Territorial"
                description="Información de impacto de brigadas."
              />
              <div className="mt-6 space-y-6">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Impacto Social</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Las brigadas de salud permiten descentralizar la atención médica veterinaria hacia comunidades rurales y sectores vulnerables. La trazabilidad de atenciones garantiza la continuidad de la salud pública regional.
                  </p>
                </div>
                <div className="flex items-center justify-between p-4 bg-accent/5 border border-accent/10 rounded-2xl">
                  <div>
                    <h5 className="text-xs font-extrabold text-accent uppercase tracking-wider">Atenciones consolidadas</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">Mascotas atendidas en brigada</p>
                  </div>
                  <span className="text-lg font-black text-accent bg-white px-3 py-1 rounded-xl shadow-sm border border-accent/10">100%</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <>

      {(error || catalogError) && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm p-4 rounded-xl border border-red-100">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error || catalogError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      ) : brigadas.length === 0 ? (
        <div className="premium-card grid gap-5 p-8 text-center md:grid-cols-[0.85fr_1.15fr] md:text-left">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-4">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 mb-1">No hay brigadas registradas</h3>
            <p className="text-sm leading-6 text-slate-500 max-w-xl mb-6">
              Crea una jornada básica o espera a ser asignado como participante. Cuando exista actividad, aquí verás estado, equipo y atenciones de la operación.
            </p>
            {canManage && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-xs font-bold text-white hover:bg-accent-strong transition-colors"
              >
                <Plus className="h-4 w-4" />
                Crear brigada
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className={`${gridBrigadasClass} self-start`} data-tour="brigadas-lista">
          {brigadas.map((brigada) => {
            const estado = ESTADO_CONFIG[brigada.estado] || ESTADO_CONFIG.planificada;
            return (
              <button
                key={brigada.id}
                type="button"
                onClick={() => void loadDetail(brigada)}
                className="premium-card premium-card-hover text-left p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <Activity className="h-5 w-5 text-accent" />
                  </div>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg border ${estado.classes}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${estado.dot}`} />
                    {estado.label}
                  </span>
                </div>
                <h3 className="font-extrabold text-slate-800 text-sm mb-1 line-clamp-1">{brigada.nombre}</h3>
                {brigada.descripcion && <p className="text-xs text-slate-500 line-clamp-2">{brigada.descripcion}</p>}
                <div className="space-y-1.5 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {new Date(`${brigada.fecha}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    {brigada.ubicacion.ciudad}
                    {brigada.ubicacion.direccion && <span className="text-slate-400">- {brigada.ubicacion.direccion}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {(brigada.veterinarioIds ?? []).length} participantes
                  </div>
                </div>
              </button>
            );
          })}
          </div>
          <aside className="premium-card h-fit p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--accent)]">Contexto operativo</p>
            <h2 className="mt-2 text-lg font-black text-slate-900">Jornada bajo control</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Selecciona una brigada para revisar consolidado, participantes y atenciones sin crear datos adicionales.
            </p>
            <div className="mt-5 grid gap-3">
              {brigadas.length === 1 && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                  <span className="text-xs font-bold text-emerald-700">Operación focalizada</span>
                  <strong className="mt-1 block text-sm text-slate-900">
                    Una jornada activa en vista ejecutiva
                  </strong>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    El detalle mantiene el foco en estado, participantes y próxima acción sin abrir módulos incompletos.
                  </p>
                </div>
              )}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-xs font-bold text-slate-500">Estado siguiente</span>
                <strong className="mt-1 block text-sm text-slate-900">Planificar, iniciar o finalizar</strong>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-xs font-bold text-slate-500">Atenciones</span>
                <strong className="mt-1 block text-sm text-slate-900">Lectura segura por scope</strong>
              </div>
            </div>
          </aside>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-6 space-y-5 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-extrabold text-slate-800">{editing ? 'Editar brigada' : 'Nueva brigada'}</h2>
              <button onClick={closeForm} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            {formError && (
              <div className="flex items-start gap-2 bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-100">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}
            <form onSubmit={handleCreateOrEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nombre" required>
                  <input className={inputClasses} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </Field>
                <Field label="Fecha" required>
                  <input type="date" className={inputClasses} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
                </Field>
                <Field label="Ciudad" required>
                  <input className={inputClasses} value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} />
                </Field>
                <Field label="Direccion">
                  <input className={inputClasses} value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
                </Field>
              </div>
              <Field label="Descripcion">
                <textarea className={inputClasses} rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </Field>
              {canChooseSede && (
                <Field label="Sede">
                  <select
                    aria-label="Sede"
                    className={inputClasses}
                    value={form.veterinariaId}
                    onChange={(e) => setForm({ ...form, veterinariaId: e.target.value, veterinarioIds: [] })}
                  >
                    <option value="">Brigada general de entidad</option>
                    {sedes.map((sede) => (
                      <option key={sede.id} value={sede.id}>{sede.nombre}</option>
                    ))}
                  </select>
                </Field>
              )}
              {canManage && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Participantes</p>
                  {participantesDisponibles.length === 0 ? (
                    <p className="text-xs text-slate-500 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      No hay veterinarios disponibles para este scope.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {participantesDisponibles.map((miembro) => (
                        <label key={miembro.id} className="flex items-center gap-2 rounded-xl border border-slate-100 p-3 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={form.veterinarioIds.includes(miembro.uid)}
                            onChange={() => toggleParticipante(miembro.uid)}
                          />
                          <span className="truncate">{miembro.email || miembro.uid}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeForm} className="flex-1 py-2.5 text-sm font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="flex-1 py-2.5 text-sm font-bold text-white bg-accent hover:bg-accent-strong rounded-xl disabled:opacity-50">
                  {submitting ? 'Guardando...' : editing ? 'Guardar brigada' : 'Crear brigada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl p-6 space-y-5 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-800">{selected.nombre}</h2>
                <p className="text-xs text-slate-500">{selected.ubicacion.ciudad} - {selected.fecha}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {detailError && (
              <div className="flex items-start gap-2 bg-red-50 text-red-700 text-xs p-3 rounded-xl border border-red-100">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{detailError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric icon={ClipboardList} label="Atenciones" value={consolidado?.totalAtenciones ?? 0} />
              <Metric icon={Users} label="Pacientes" value={consolidado?.pacientesUnicos ?? 0} />
              <Metric icon={Stethoscope} label="Participantes" value={consolidado?.veterinariosParticipantes ?? selected.veterinarioIds.length} />
              <Metric icon={CheckCircle2} label="Con atención" value={consolidado?.veterinariosConAtencion ?? 0} />
            </div>

            <div className="flex flex-wrap gap-2">
              {estadoSiguiente(selected) && (
                <button
                  data-tour="brigadas-activa"
                  onClick={() => void handleEstado(selected, estadoSiguiente(selected) as Brigada['estado'])}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  {selected.estado === 'planificada' ? 'Iniciar brigada' : 'Finalizar brigada'}
                </button>
              )}
              {canManage && (
                <button
                  onClick={() => openEdit(selected)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Editar brigada
                </button>
              )}
            </div>


            <div>
              <h3 className="text-sm font-extrabold text-slate-800 mb-3">Atenciones registradas</h3>
              {atenciones.length === 0 ? (
                <p className="text-xs text-slate-500 rounded-xl border border-slate-100 p-4">Aún no hay atenciones registradas.</p>
              ) : (
                <ul className="space-y-2">
                  {atenciones.map((atencion) => (
                    <li key={atencion.id} className="rounded-xl border border-slate-100 p-3">
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <p className="text-sm font-bold text-slate-800">{atencion.motivo}</p>
                        <p className="text-xs text-slate-500">{new Date(atencion.fechaHora).toLocaleString('es-ES')}</p>
                      </div>
                      <p className="text-xs text-slate-500">
                        Vet {atencion.veterinarioId}
                        {atencion.pacienteId ? ` - Paciente ${atencion.pacienteId}` : ''}
                        {atencion.especie ? ` - ${atencion.especie}` : ''}
                      </p>
                      {atencion.notas && <p className="text-xs text-slate-600 mt-1">{atencion.notas}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      </>
      )}
      <TourHelpButton onReplay={replay} />
    </div>
  );
};

const inputClasses =
  'w-full min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition-all placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-100 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-black text-slate-800">{value}</p>
    </div>
  );
}

export default Brigadas;
export { Brigadas };
