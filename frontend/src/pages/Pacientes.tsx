import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePacientes } from '../hooks/usePacientes';
import { listarCitas, type Cita as CitaApi } from '../features/citas/api';
import PacienteCard from '../components/PacienteCard';
import { Search, Plus, Filter, AlertCircle, LayoutGrid, List } from 'lucide-react';
import type { Cita } from '../types';

const SPECIES_EMOJI: Record<string, string> = {
  perro: '🐶', gato: '🐱', ave: '🦜', reptil: '🦎', otro: '🐾'
};

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

const Pacientes: React.FC = () => {
  const { pacientes, loading, error } = usePacientes();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEspecie, setSelectedEspecie] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [citas, setCitas] = useState<Cita[]>([]);

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="command-hero flex flex-col justify-between gap-5 p-6 sm:p-8 lg:flex-row lg:items-end">
        <div>
          <span className="inline-flex rounded-full border border-white/15 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-100">
            Expedientes clinicos
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Pacientes</h1>
          <p className="text-sm text-slate-500">Gestiona los expedientes clínicos de todas las mascotas registradas.</p>
        </div>
        <Link
          to="/pacientes/nuevo"
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-[var(--accent-strong)] shadow-lg transition-all hover:brightness-95"
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

      {/* Search, Filter and View toggle */}
      <div className="command-panel flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre de mascota, propietario o raza..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white/80 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-[var(--accent)] focus:bg-white focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Species filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {especies.map((esp) => (
              <button
                key={esp.value}
                onClick={() => setSelectedEspecie(esp.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border transition-all ${
                  selectedEspecie === esp.value
                    ? 'bg-[#0F6E56] text-white border-[#0F6E56] shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{esp.emoji}</span>
                <span className="hidden sm:inline">{esp.label}</span>
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 rounded-full p-1 gap-1">
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-full transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-[#0F6E56]' : 'text-slate-400 hover:text-slate-600'}`}
              title="Vista tarjeta"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#0F6E56]' : 'text-slate-400 hover:text-slate-600'}`}
              title="Vista lista"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F6E56] border-t-transparent"></div>
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F6E56] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0c5945] transition-colors shadow-md shadow-[#0F6E56]/15"
            >
              <Plus className="h-4 w-4" />
              Crear Ficha Médica
            </Link>
          )}
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPacientes.map((paciente) => {
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
        /* List view */
        <div className="premium-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Mascota</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Especie</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider hidden md:table-cell">Propietario</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Último Peso</th>
                <th className="text-left px-4 py-3.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Próxima Cita</th>
                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPacientes.map((paciente) => {
                const cita = getUpcomingCita(paciente.id!);
                return (
                  <tr key={paciente.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {paciente.foto ? (
                          <img src={paciente.foto} alt={paciente.nombre} className="h-9 w-9 rounded-full object-cover border border-slate-100 shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-[#0F6E56]/10 flex items-center justify-center text-lg shrink-0">
                            {SPECIES_EMOJI[paciente.especie] || '🐾'}
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-slate-800 text-sm">{paciente.nombre}</span>
                          {paciente.raza && <span className="text-xs text-slate-400 block">{paciente.raza}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span className="text-sm text-slate-600 capitalize">{SPECIES_EMOJI[paciente.especie]} {paciente.especie}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-sm text-slate-700">{paciente.propietario.nombre}</span>
                      <span className="text-xs text-slate-400 block">{paciente.propietario.telefono}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {paciente.ultimoPeso ? (
                        <span className="inline-block bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg">{paciente.ultimoPeso} kg</span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {cita ? (
                        <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-extrabold px-2.5 py-1 rounded-lg whitespace-nowrap">
                          🗓 {cita.fecha.slice(5).replace('-', '/')} {cita.horaInicio}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">Sin cita próxima</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        to={`/pacientes/${paciente.id}`}
                        className="text-xs font-bold text-[#0F6E56] hover:text-[#0c5945] hover:underline transition-colors"
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
    </div>
  );
};

export default Pacientes;
export { Pacientes };
