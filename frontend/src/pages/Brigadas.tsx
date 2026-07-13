import React, { useEffect, useMemo, useState } from 'react';
import { useTourGuide } from '../hooks/useTourGuide';
import {
  Activity, AlertCircle, Calendar, CheckCircle2, ChevronDown, ClipboardList,
  Filter, MapPin, Plus, Search, Stethoscope, Users, X,
} from 'lucide-react';
import { useBrigadas } from '../hooks/useBrigadas';
import { useMe } from '../features/tenant/hooks';
import { normalizarRol } from '../lib/rbac';
import { getErrorMessage } from '../lib/errors';
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

/** Pildora de filtro rapido: icono en circulo solido + valor + etiqueta, clicable para
 * filtrar el listado por estado (reemplaza la fila de tarjetas KPI grandes). */
const FilterPill: React.FC<{
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  accent: string;
  accentBg: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, value, label, accent, accentBg, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-bold transition-all ${
      active ? 'opacity-100' : 'opacity-60 hover:opacity-90'
    }`}
    style={{
      background: accentBg,
      color: accent,
      border: `1px solid color-mix(in srgb, ${accent} ${active ? '45%' : '20%'}, transparent)`,
      boxShadow: active ? '0 2px 6px rgba(15, 23, 42, 0.12)' : '0 1px 2px rgba(15, 23, 42, 0.06)',
    }}
  >
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: accent }}>
      {icon}
    </span>
    <span className="font-black">{value}</span>
    <span className="font-semibold opacity-80">{label}</span>
  </button>
);

const TOUR_STEPS_BRIGADAS = [
  { element: '[data-tour="brigadas-lista"]', popover: { title: 'Listado de brigadas', description: 'Las brigadas agrupan las consultas que atiendes en una jornada de campo (por ejemplo, una jornada de vacunación o esterilización fuera de la clínica).' } },
  { element: '[data-tour="brigadas-activa"]', popover: { title: 'Brigada activa', description: 'Actívala antes de empezar a atender el día de la jornada, y todas las consultas que registres quedarán asociadas automáticamente a esa brigada, sin tener que elegirla cada vez.' } },
];

const Brigadas: React.FC = () => {
  const { data: me } = useMe();
  const rol = normalizarRol(me?.role ?? me?.rol ?? null);
  const { brigadas, loading, error, crearBrigada, actualizarBrigada } = useBrigadas();
  useTourGuide('brigadas', TOUR_STEPS_BRIGADAS);

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
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<'todas' | Brigada['estado']>('todas');
  const [cityFilter, setCityFilter] = useState('todas');
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  const brigadasFinalizadas = brigadas.filter((b) => b.estado === 'finalizada').length;

  const ciudades = useMemo(
    () => Array.from(new Set(brigadas.map((b) => b.ubicacion.ciudad).filter(Boolean))).sort(),
    [brigadas],
  );

  const filteredBrigadas = brigadas.filter((b) => {
    const matchesEstado = estadoFilter === 'todas' || b.estado === estadoFilter;
    const matchesCiudad = cityFilter === 'todas' || b.ubicacion.ciudad === cityFilter;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !term ||
      b.nombre.toLowerCase().includes(term) ||
      b.ubicacion.ciudad.toLowerCase().includes(term);
    return matchesEstado && matchesCiudad && matchesSearch;
  });

  const activeFilterCount = (cityFilter !== 'todas' ? 1 : 0) + (searchTerm.trim() ? 1 : 0);
  const gridBrigadasClass =
    filteredBrigadas.length === 1
      ? 'grid grid-cols-1 gap-4'
      : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  return (
    <div className="space-y-3 animate-fade-in py-4">
      {/* Titulo + accion primaria: una sola fila (envuelve en celular). */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-black text-slate-900">Brigadas de Salud</h1>
        {canManage && (
          <button
            onClick={openCreate}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-accent-strong transition-all"
          >
            <Plus className="h-4 w-4" />
            Nueva brigada
          </button>
        )}
      </div>

      {/* Filtros rapidos por estado: pildoras clicables que reemplazan la fila de KPIs grandes. */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          icon={<Users className="h-3.5 w-3.5" />}
          value={brigadas.length}
          label="Todas"
          accent="var(--accent)"
          accentBg="var(--accent-soft)"
          active={estadoFilter === 'todas'}
          onClick={() => setEstadoFilter('todas')}
        />
        <FilterPill
          icon={<Calendar className="h-3.5 w-3.5" />}
          value={brigadasPlanificadas}
          label="Planificadas"
          accent="#475569"
          accentBg="#f1f5f9"
          active={estadoFilter === 'planificada'}
          onClick={() => setEstadoFilter('planificada')}
        />
        <FilterPill
          icon={<Activity className="h-3.5 w-3.5" />}
          value={brigadasActivas}
          label="En curso"
          accent="var(--success)"
          accentBg="var(--success-soft)"
          active={estadoFilter === 'en_curso'}
          onClick={() => setEstadoFilter('en_curso')}
        />
        <FilterPill
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          value={brigadasFinalizadas}
          label="Finalizadas"
          accent="var(--info)"
          accentBg="var(--info-soft)"
          active={estadoFilter === 'finalizada'}
          onClick={() => setEstadoFilter('finalizada')}
        />
      </div>

      {/* Busqueda + filtro de ciudad: una sola fila compacta (mismo patron que Pacientes). */}
      <div className="command-panel p-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o ciudad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/12"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:border-slate-300"
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-black text-white">{activeFilterCount}</span>
            )}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {filtersOpen && ciudades.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
            <button
              onClick={() => setCityFilter('todas')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                cityFilter === 'todas'
                  ? 'bg-accent text-white border-accent shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              Todas las ciudades
            </button>
            {ciudades.map((ciudad) => (
              <button
                key={ciudad}
                onClick={() => setCityFilter(ciudad)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  cityFilter === ciudad
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {ciudad}
              </button>
            ))}
          </div>
        )}
      </div>

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
      ) : filteredBrigadas.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-4">
            <Filter className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No se encontraron brigadas</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Intenta cambiar el estado, la ciudad o el término de búsqueda aplicados.
          </p>
        </div>
      ) : (
        <div className={gridBrigadasClass} data-tour="brigadas-lista">
          {filteredBrigadas.map((brigada) => {
            const estado = ESTADO_CONFIG[brigada.estado] || ESTADO_CONFIG.planificada;
            return (
              <button
                key={brigada.id}
                type="button"
                onClick={() => void loadDetail(brigada)}
                className="premium-card premium-card-hover text-left p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <Activity className="h-4.5 w-4.5 text-accent" />
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
