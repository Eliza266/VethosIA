import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePacientes } from '../hooks/usePacientes';
import { useConsultas } from '../hooks/useConsultas';
import { VacunasPanel } from '../features/vacunas/VacunasPanel';
import { EvolucionClinicaPanel } from '../features/pacientes/EvolucionClinicaPanel';
import { construirEvolucionClinica } from '../features/pacientes/evolucion';
import type { Paciente, Consulta } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  ArrowLeft,
  Plus,
  Phone,
  Mail,
  User,
  FileText,
  ShieldAlert,
  Info,
  ChevronRight,
  TrendingUp
} from 'lucide-react';

const parseLocalDate = (dateString: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
  if (!match) return new Date(dateString);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const DetallePaciente: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { getPaciente, pacientes, fetchPacientes } = usePacientes();
  const { fetchConsultasPorPaciente } = useConsultas();

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [consultasPaciente, setConsultasPaciente] = useState<Consulta[]>([]);
  const [loadingGeneral, setLoadingGeneral] = useState(true);
  
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroFechas, setFiltroFechas] = useState({ desde: '', hasta: '' });

  const consultasFiltradas = useMemo(() => {
    let filtered = [...consultasPaciente];
    if (filtroFechas.desde) {
      const start = new Date(filtroFechas.desde);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(c => new Date(c.fechaHora).getTime() >= start.getTime());
    }
    if (filtroFechas.hasta) {
      const end = new Date(filtroFechas.hasta);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(c => new Date(c.fechaHora).getTime() <= end.getTime());
    }
    return filtered;
  }, [consultasPaciente, filtroFechas]);

  const handleFilter = () => {
    setFiltroFechas({ desde: fechaDesde, hasta: fechaHasta });
  };

  const handleClearFilter = () => {
    setFechaDesde('');
    setFechaHasta('');
    setFiltroFechas({ desde: '', hasta: '' });
  };

  useEffect(() => {
    fetchPacientes();
  }, [fetchPacientes]);

  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        setLoadingGeneral(false);
        return;
      }
      setLoadingGeneral(true);
      try {
        const pacData = await getPaciente(id);
        if (pacData) {
          setPaciente(pacData);
          try {
            const consData = await fetchConsultasPorPaciente(id);
            setConsultasPaciente(consData || []);
          } catch {
            setConsultasPaciente([]);
          }
        }
      } finally {
        setLoadingGeneral(false);
      }
    };
    loadData();
  }, [fetchConsultasPorPaciente, getPaciente, id]);

  if (loadingGeneral) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0F6E56] border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-500 animate-pulse">Cargando historial clínico...</p>
        </div>
      </div>
    );
  }

  if (!paciente) {
    return (
      <div className="max-w-md mx-auto text-center py-12 bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
        <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800 mb-2">Expediente no encontrado</h3>
        <p className="text-sm text-slate-500 mb-6">El paciente solicitado no existe o no tienes los permisos para visualizarlo.</p>
        <Link to="/pacientes" className="px-4 py-2.5 rounded-xl bg-[#0F6E56] text-white text-sm font-bold">
          Volver a Pacientes
        </Link>
      </div>
    );
  }

  const getAge = (birthDateString?: string) => {
    if (!birthDateString) return 'No registrada';
    const birthDate = parseLocalDate(birthDateString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age === 0) {
      const months = (today.getFullYear() - birthDate.getFullYear()) * 12 + today.getMonth() - birthDate.getMonth();
      return months <= 0 ? 'Recién nacido' : `${months} ${months === 1 ? 'mes' : 'meses'}`;
    }
    return `${age} ${age === 1 ? 'año' : 'años'}`;
  };

  const getSpeciesEmoji = (esp: Paciente['especie']) => {
    switch (esp) {
      case 'perro': return '🐶';
      case 'gato': return '🐱';
      case 'ave': return '🦜';
      case 'reptil': return '🦎';
      default: return '🐾';
    }
  };

  const otrosPacientes = pacientes.filter(p => p.id !== id);

  // Evolución data
  const evolucionClinica = construirEvolucionClinica(consultasPaciente);
  const evolucionDatos = evolucionClinica.puntos
    .filter((p) => p.peso !== undefined || p.temperatura !== undefined)
    .map((p) => ({
      fecha: p.fechaLabel,
      peso: p.peso ?? null,
      temperatura: p.temperatura ?? null,
      hc: p.numeroHC || ''
    }));

  const hasPesoData = evolucionDatos.some(d => d.peso !== null);
  const hasTempData = evolucionDatos.some(d => d.temperatura !== null);
  const formatPesoTooltip = (value: unknown) => [`${value} kg`, 'Peso'];
  const formatTemperaturaTooltip = (value: unknown) => [`${value} °C`, 'Temperatura'];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Navigation & Header */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/pacientes"
            className="p-2 bg-white rounded-xl border border-slate-100 hover:border-slate-200 text-slate-500 hover:text-[#0F6E56] transition-colors"
            title="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-4">
            {paciente.foto ? (
              <img src={paciente.foto} alt={paciente.nombre} className="h-16 w-16 rounded-full object-cover shadow-sm border-2 border-white" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl shadow-sm border-2 border-white">
                {getSpeciesEmoji(paciente.especie)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">{paciente.nombre}</h1>
              <p className="text-sm text-slate-500 font-medium capitalize">
                {paciente.especie} {paciente.raza ? `• ${paciente.raza}` : ''}
              </p>
            </div>
          </div>
        </div>

        <Link
          to={`/pacientes/${paciente.id}/consultas/nueva`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F6E56] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[#0F6E56]/15 transition-all hover:bg-[#0c5945] sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Nueva Consulta
        </Link>
      </div>
      </div>

      {id && (
        <div className="mb-8">
          <VacunasPanel pacienteId={id} pacienteEspecie={paciente.especie} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Medical card & Owner card */}
        <div className="space-y-6">
          {/* Pet Details Card */}
          <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-2">Datos Fisiológicos</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-50/50">
                <span className="text-slate-400 font-medium">Sexo</span>
                <span className="font-bold text-slate-700 capitalize">{paciente.sexo}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50/50">
                <span className="text-slate-400 font-medium">Edad</span>
                <span className="font-bold text-slate-700">{getAge(paciente.fechaNacimiento)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50/50">
                <span className="text-slate-400 font-medium">Reproducción</span>
                <span className="font-bold text-slate-700 capitalize">{paciente.estadoReproductivo}</span>
              </div>
              {paciente.color && (
                <div className="flex justify-between py-1 border-b border-slate-50/50">
                  <span className="text-slate-400 font-medium">Color/Pelaje</span>
                  <span className="font-bold text-slate-700">{paciente.color}</span>
                </div>
              )}
              {paciente.chip && (
                <div className="flex justify-between py-1 border-b border-slate-50/50">
                  <span className="text-slate-400 font-medium">Microchip</span>
                  <span className="font-bold text-slate-700">{paciente.chip}</span>
                </div>
              )}
              {paciente.origen && (
                <div className="flex justify-between py-1 border-b border-slate-50/50">
                  <span className="text-slate-400 font-medium">Origen</span>
                  <span className="font-bold text-slate-700">{paciente.origen}</span>
                </div>
              )}
              {paciente.ultimoPeso && (
                <div className="flex justify-between items-center py-1 border-b border-slate-50/50">
                  <span className="text-slate-400 font-medium">Último Peso</span>
                  <span className="bg-[#0F6E56]/10 text-[#0F6E56] font-bold px-2 py-0.5 rounded-lg">{paciente.ultimoPeso} kg</span>
                </div>
              )}
              {paciente.ultimaTalla && (
                <div className="flex justify-between items-center py-1 border-b border-slate-50/50">
                  <span className="text-slate-400 font-medium">Última Talla</span>
                  <span className="bg-[#0F6E56]/10 text-[#0F6E56] font-bold px-2 py-0.5 rounded-lg">{paciente.ultimaTalla} cm</span>
                </div>
              )}
            </div>
          </div>

          {/* Owner details card */}
          <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-50 pb-2">Información del Propietario</h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Nombre del Dueño</div>
                  <div className="text-sm font-bold text-slate-700">{paciente.propietario.nombre}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Teléfono</div>
                  <a href={`tel:${paciente.propietario.telefono}`} className="text-sm font-bold text-[#0F6E56] hover:underline">
                    {paciente.propietario.telefono}
                  </a>
                  {paciente.propietario.whatsapp && (
                    <span className="text-xs text-slate-500 block">WA: {paciente.propietario.whatsapp}</span>
                  )}
                </div>
              </div>

              {paciente.propietario.email && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Correo Electrónico</div>
                    <a href={`mailto:${paciente.propietario.email}`} className="text-sm font-bold text-slate-700 hover:underline truncate block max-w-[180px]">
                      {paciente.propietario.email}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* General Notes Card */}
          {paciente.notasGenerales && (
            <div className="space-y-3 rounded-2xl border border-amber-100 bg-white p-6 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 text-amber-700">
                <Info className="h-4 w-4" />
                Alertas / Notas Clínicas
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed bg-amber-50/40 p-3 rounded-xl border border-amber-100/50">
                {paciente.notasGenerales}
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Evolución & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <EvolucionClinicaPanel consultas={consultasPaciente} />

          {/* Evolución Clínica Charts */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 mb-6 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#0F6E56]" />
              Evolución Clínica
            </h3>
            
            {evolucionDatos.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <TrendingUp className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium">No hay datos de evolución</p>
                <p className="text-xs mt-1 max-w-sm mx-auto">
                  Registra signos vitales (peso, temperatura) en las consultas para ver la gráfica de evolución clínica.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {hasPesoData && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-600 text-center">Peso (kg)</h4>
                    <div style={{ width: '100%', height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={evolucionDatos}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={30} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={formatPesoTooltip}
                            labelStyle={{ fontWeight: 'bold', color: '#334155' }}
                          />
                          <Line type="monotone" dataKey="peso" stroke="#0F6E56" strokeWidth={3} dot={{ fill: '#0F6E56', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                
                {hasTempData && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-600 text-center">Temperatura (°C)</h4>
                    <div style={{ width: '100%', height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={evolucionDatos}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                          <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={30} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={formatTemperaturaTooltip}
                            labelStyle={{ fontWeight: 'bold', color: '#334155' }}
                          />
                          <Line type="monotone" dataKey="temperatura" stroke="#185FA5" strokeWidth={3} dot={{ fill: '#185FA5', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
            <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 mb-6">Historial de Consultas Clínicas</h3>

            {consultasPaciente.length > 0 && (
              <div className="flex flex-wrap items-end gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-[#0F6E56] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-[#0F6E56] outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleFilter}
                    className="px-4 py-2 bg-[#0F6E56] hover:bg-[#0c5945] text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    Filtrar
                  </button>
                  {(fechaDesde || fechaHasta) && (
                    <button
                      onClick={handleClearFilter}
                      className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-sm font-bold rounded-lg transition-colors"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            )}

            {consultasFiltradas.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm">
                  {consultasPaciente.length === 0 ? 'No hay consultas registradas en este expediente.' : 'No hay consultas en el rango de fechas seleccionado.'}
                </p>
                {consultasPaciente.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">Haz clic en "Nueva Consulta" para iniciar una evaluación clínica.</p>
                )}
              </div>
            ) : (
              <div className="relative border-l border-slate-100 pl-6 ml-3 space-y-8">
                {consultasFiltradas.map((consulta) => (
                  <div key={consulta.id} className="relative group">
                    <span className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${consulta.estado === 'aprobada'
                        ? 'bg-emerald-500'
                        : consulta.estado === 'procesando'
                          ? 'bg-amber-500 animate-pulse'
                          : consulta.estado === 'error'
                            ? 'bg-red-500'
                            : 'bg-slate-400'
                      }`}></span>

                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 group-hover:bg-slate-50 group-hover:border-slate-200 transition-all">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700">
                            {new Date(consulta.fechaHora).toLocaleDateString()}
                          </span>
                          <span className="text-slate-300 text-xs">•</span>
                          <span className="text-xs text-slate-400 font-medium">
                            {new Date(consulta.fechaHora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {consulta.numeroHC && (
                            <>
                              <span className="text-slate-300 text-xs">•</span>
                              <span className="text-xs font-bold text-[#0F6E56]">#{consulta.numeroHC}</span>
                            </>
                          )}
                        </div>

                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${consulta.estado === 'aprobada'
                            ? 'bg-emerald-50 text-emerald-700'
                            : consulta.estado === 'procesando'
                              ? 'bg-amber-50 text-amber-700 animate-pulse'
                              : consulta.estado === 'error'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}>
                          {consulta.estado === 'aprobada' ? 'Completado' : consulta.estado === 'procesando' ? 'Procesando con IA' : consulta.estado === 'error' ? 'Error' : 'Borrador'}
                        </span>
                      </div>

                      {consulta.soap ? (
                        <div className="space-y-1 mt-3">
                          <div className="text-xs text-slate-600 truncate">
                            <span className="font-semibold text-slate-700">S:</span> {consulta.soap.subjetivo}
                          </div>
                          <div className="text-xs text-slate-600 truncate">
                            <span className="font-semibold text-slate-700">A:</span> {consulta.soap.analisis}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs italic text-slate-400 mt-2">
                          {consulta.estado === 'procesando' ? 'La IA está generando la nota...' : 'Consulta clínica vacía.'}
                        </p>
                      )}

                      <div className="flex justify-end mt-4 pt-3 border-t border-slate-100/50">
                        <Link
                          to={`/pacientes/${paciente.id}/consultas/${consulta.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#0F6E56] hover:underline"
                        >
                          Ver Consulta
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Otros Pacientes Section */}
          {otrosPacientes.length > 0 && (
            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 mb-4">Otros Pacientes</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {otrosPacientes.slice(0, 10).map((p) => (
                  <Link
                    key={p.id}
                    to={`/pacientes/${p.id}`}
                    className="flex items-center gap-3 px-4 py-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 hover:border-[#0F6E56]/30 rounded-xl transition-all shrink-0 min-w-[180px]"
                  >
                    <span className="text-xl">{getSpeciesEmoji(p.especie)}</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{p.nombre}</h4>
                      <p className="text-[10px] text-slate-400 capitalize truncate">{p.raza || p.especie} • {p.sexo}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetallePaciente;
export { DetallePaciente };
