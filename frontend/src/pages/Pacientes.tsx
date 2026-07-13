import React, { useEffect, useState } from 'react';
import { useTourGuide } from '../hooks/useTourGuide';
import { Link } from 'react-router-dom';
import { usePacientes } from '../hooks/usePacientes';
import { listarCitas, type Cita as CitaApi } from '../features/citas/api';
import PacienteCard from '../components/PacienteCard';
import {
  Search, Plus, Filter, AlertCircle, LayoutGrid, List,
  Users, CalendarClock, Scale, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { Cita, Paciente } from '../types';

const SPECIES_AVATAR: Record<string, string> = {
  perro: 'bg-amber-100 text-amber-800',
  gato: 'bg-purple-100 text-purple-800',
  ave: 'bg-sky-100 text-sky-800',
  reptil: 'bg-emerald-100 text-emerald-800',
  otro: 'bg-slate-100 text-slate-800',
};

const SPECIES_EMOJI: Record<string, string> = {
  perro: '🐶', gato: '🐱', ave: '🦜', reptil: '🦎', otro: '🐾'
};

const avatarClass = (especie: string): string => SPECIES_AVATAR[especie] || SPECIES_AVATAR.otro;
const initialOf = (nombre: string): string => nombre.trim().charAt(0).toUpperCase() || '?';

const PAGE_SIZE = 8;

const fechaDiaLocal = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const horaDesdeIso = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });

const mapCitaApi = (c: CitaApi): Cita => ({
  id: c.id,
  pacienteId: c.pacienteId ?? '',
  nombrePaciente: c.pacienteNombre ?? c.titulo,
  veterinarioId: '',
  fecha: fechaDiaLocal(c.fecha),
  horaInicio: horaDesdeIso(c.fecha),
  duracion: 30,
  motivo: c.motivo ?? c.titulo,
  estado: c.estado,
  consultaId: c.consultaId,
  creadoEn: new Date(),
});

const TOUR_STEPS_PACIENTES = [
  { element: '[data-tour="pacientes-busqueda"]', popover: { title: 'Buscar pacientes', description: 'Aquí ves todos los pacientes registrados. Busca por nombre de mascota, dueño o raza, y filtra por especie con los botones de arriba.' } },
  { element: '[data-tour="pacientes-nuevo"]', popover: { title: 'Nuevo paciente', description: 'Registra una ficha completa antes de la consulta: datos de la mascota, especie, raza y datos del propietario (incluye teléfono con indicativo de país).' } },
];

/** Pildora KPI compacta: icono en su propio circulo solido (dos tonos) + sombra sutil,
 * para que no se vea plana, sin crecer en tamaño. */
const KpiPill: React.FC<{ icon: React.ReactNode; value: React.ReactNode; label: string; accent: string; accentBg: string }> = ({
  icon,
  value,
  label,
  accent,
  accentBg,
}) => (
  <span
    className="inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-bold"
    style={{ background: accentBg, color: accent, border: `1px solid color-mix(in srgb, ${accent} 20%, transparent)`, boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)' }}
  >
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: accent }}>
      {icon}
    </span>
    <span className="font-black">{value}</span>
    <span className="font-semibold opacity-80">{label}</span>
  </span>
);

const Pacientes: React.FC = () => {
  const { pacientes: pacientesConPlaceholders, loading, error } = usePacientes();
  // Los placeholders de "consulta rapida" son temporales (se confirman o se descartan desde
  // DetalleConsulta); no deben aparecer como pacientes reales en el listado.
  const pacientes = pacientesConPlaceholders.filter((p) => !p.esPlaceholder);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEspecie, setSelectedEspecie] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [citas, setCitas] = useState<Cita[]>([]);

  useTourGuide('pacientes-lista', TOUR_STEPS_PACIENTES);

  const especies = [
    { value: 'todos', label: 'Todos', emoji: '🐾' },
    { value: 'perro', label: 'Perros', emoji: '🐶' },
    { value: 'gato', label: 'Gatos', emoji: '🐱' },
    { value: 'ave', label: 'Aves', emoji: '🦜' },
    { value: 'reptil', label: 'Reptiles', emoji: '🦎' },
    { value: 'otro', label: 'Otros', emoji: '🦄' },
  ];

  // Próximas citas programadas via /v1/citas (badge en tarjeta/lista).
  useEffect(() => {
    const fetchCitas = async () => {
      try {
        const apiCitas = await listarCitas();
        setCitas(
          apiCitas
            .filter((c) => c.estado === 'programada')
            .map(mapCitaApi),
        );
      } catch (e) {
        console.error('Error loading citas for badge:', e);
      }
    };
    fetchCitas();
  }, []);

  const getUpcomingCita = (pacienteId: string): Cita | null => {
    const now = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];
    const limitStr = in7days.toISOString().split('T')[0];
    return citas.find((c) => c.pacienteId === pacienteId && c.fecha >= todayStr && c.fecha <= limitStr) ?? null;
  };

  const filteredPacientes = pacientes.filter((paciente) => {
    const matchesSearch =
      paciente.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paciente.propietario.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (paciente.raza && paciente.raza.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesEspecie = selectedEspecie === 'todos' || paciente.especie === selectedEspecie;
    return matchesSearch && matchesEspecie;
  });

  // Reinicia a la pagina 1 cuando cambia la busqueda/filtro (si no, se puede quedar
  // viendo una pagina vacia si el resultado filtrado tiene menos paginas que antes).
  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedEspecie]);

  const totalPages = Math.max(1, Math.ceil(filteredPacientes.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedPacientes = filteredPacientes.slice(pageStart, pageStart + PAGE_SIZE);

  const totalPacientes = pacientes.length;
  const conPesoCount = pacientes.filter((p: Paciente) => p.ultimoPeso).length;
  const sinPesoCount = totalPacientes - conPesoCount;
  const activeFilterCount = (selectedEspecie !== 'todos' ? 1 : 0) + (searchTerm.trim() ? 1 : 0);

  return (
    <div className="space-y-3 animate-fade-in py-4">
      {/* Titulo + KPIs de un vistazo + accion primaria: todo en una sola fila (envuelve
          en celular en vez de apilarse en niveles separados). */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl font-black text-slate-900">Pacientes</h1>
        <KpiPill icon={<Users className="h-3.5 w-3.5" />} value={totalPacientes} label="total" accent="var(--info)" accentBg="var(--info-soft)" />
        <KpiPill icon={<CalendarClock className="h-3.5 w-3.5" />} value={citas.length} label="Con cita" accent="var(--success)" accentBg="var(--success-soft)" />
        <KpiPill icon={<Scale className="h-3.5 w-3.5" />} value={sinPesoCount} label="Sin peso" accent="var(--warn)" accentBg="var(--warn-soft)" />
        <Link
          to="/pacientes/nuevo"
          data-tour="pacientes-nuevo"
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-accent-strong transition-all"
        >
          <Plus className="h-4 w-4" />
          Nuevo Paciente
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm p-4 rounded-xl border border-red-100">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Búsqueda + filtros + vista: una sola fila compacta. */}
      <div className="command-panel p-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1" data-tour="pacientes-busqueda">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, propietario o raza..."
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
          <div className="flex shrink-0 items-center bg-slate-100 rounded-full p-1 gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-accent' : 'text-slate-400 hover:text-slate-600'}`}
              title="Vista lista"
              aria-label="Vista lista"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-full transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-accent' : 'text-slate-400 hover:text-slate-600'}`}
              title="Vista tarjeta"
              aria-label="Vista tarjeta"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
            {especies.map((esp) => (
              <button
                key={esp.value}
                onClick={() => setSelectedEspecie(esp.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  selectedEspecie === esp.value
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{esp.emoji}</span>
                <span>{esp.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
            <p className="text-xs text-slate-400 font-medium animate-pulse">Buscando expedientes...</p>
          </div>
        </div>
      ) : filteredPacientes.length === 0 ? (
        <div className="premium-card p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-4">
            <Filter className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No se encontraron pacientes</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
            {searchTerm || selectedEspecie !== 'todos'
              ? 'Intenta cambiar los términos de búsqueda o filtros aplicados.'
              : 'Empieza registrando tu primer paciente para ver su ficha clínica.'}
          </p>
          {!searchTerm && selectedEspecie === 'todos' && (
            <Link
              to="/pacientes/nuevo"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white hover:bg-accent-strong transition-colors shadow-md shadow-accent/15"
            >
              <Plus className="h-4 w-4" />
              Crear Ficha Médica
            </Link>
          )}
        </div>
      ) : (
        <>
          {viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {pagedPacientes.map((paciente) => {
                const cita = getUpcomingCita(paciente.id!);
                return (
                  <div key={paciente.id} className="relative">
                    <PacienteCard paciente={paciente} />
                    {cita && (
                      <div className="absolute top-3 right-3 bg-orange-500 text-white text-[10px] font-extrabold px-2 py-1 rounded-lg shadow-md z-10">
                        🗓 Cita: {cita.fecha.slice(5).replace('-', '/')} {cita.horaInicio}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* List view: filas compactas (~48-56px) para ver mas pacientes sin scroll. */
            <div className="premium-card overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Mascota</th>
                    <th className="text-left px-3 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Especie</th>
                    <th className="text-left px-3 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider hidden md:table-cell">Propietario</th>
                    <th className="text-left px-3 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Último Peso</th>
                    <th className="text-left px-3 py-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Próxima Cita</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pagedPacientes.map((paciente) => {
                    const cita = getUpcomingCita(paciente.id!);
                    return (
                      <tr key={paciente.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2.5">
                            {paciente.foto ? (
                              <img src={paciente.foto} alt={paciente.nombre} className="h-8 w-8 rounded-full object-cover border border-slate-100 shrink-0" />
                            ) : (
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${avatarClass(paciente.especie)}`}>
                                {initialOf(paciente.nombre)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="block truncate font-semibold text-slate-800 text-sm">{paciente.nombre}</span>
                              {paciente.raza && <span className="block truncate text-xs text-slate-400">{paciente.raza}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <span className="text-sm text-slate-600 capitalize">{SPECIES_EMOJI[paciente.especie]} {paciente.especie}</span>
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell">
                          <span className="block text-sm font-semibold text-slate-700">{paciente.propietario.nombre}</span>
                          <span className="block text-xs text-slate-400">{paciente.propietario.telefono}</span>
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell">
                          {paciente.ultimoPeso ? (
                            <span className="inline-block bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg">{paciente.ultimoPeso} kg</span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {cita ? (
                            <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg whitespace-nowrap">
                              🗓 {cita.fecha.slice(5).replace('-', '/')} {cita.horaInicio}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">–</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            to={`/pacientes/${paciente.id}`}
                            className="text-xs font-bold text-accent hover:text-accent-strong hover:underline transition-colors"
                          >
                            Ver expediente →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 px-1 text-xs text-slate-500">
              <span>
                Mostrando {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredPacientes.length)} de {filteredPacientes.length} pacientes
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Página anterior"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 font-bold text-slate-700">{currentPage} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Página siguiente"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Pacientes;
export { Pacientes };
