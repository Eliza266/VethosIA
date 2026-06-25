import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { usePacientes } from '../hooks/usePacientes';
import { useConsultas } from '../hooks/useConsultas';
import { VacunasPanel } from '../features/vacunas/VacunasPanel';
import { construirEvolucionClinica } from '../features/pacientes/evolucion';
import { listarVacunasPaciente } from '../features/vacunas/api';
import type { Paciente, Consulta } from '../types';
import { storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { buildPatientPhotoStoragePath } from '../lib/patientPhotoStorage';
import { BRAND } from '../lib/theme';
import { useMe } from '../features/tenant/hooks';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Plus,
  Phone,
  Mail,
  User,
  FileText,
  ShieldAlert,
  Info,
  ChevronRight,
  TrendingUp,
  Edit2,
  Calendar,
  Scale,
  Activity,
  X,
  Save,
} from 'lucide-react';

const parseLocalDate = (dateString: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
  if (!match) return new Date(dateString);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const DetallePaciente: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const activeTab = queryParams.get('tab') || 'perfil';

  const { getPaciente, pacientes, fetchPacientes, actualizarPaciente } = usePacientes();
  const { fetchConsultasPorPaciente } = useConsultas();
  const { data: me } = useMe();

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [consultasPaciente, setConsultasPaciente] = useState<Consulta[]>([]);
  const [loadingGeneral, setLoadingGeneral] = useState(true);

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFotoFile(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  // Vaccines stats
  const [vacunasCount, setVacunasCount] = useState(0);
  const [vacunasAlDia, setVacunasAlDia] = useState(0);

  // Edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nombre: '',
    sexo: 'macho' as Paciente['sexo'],
    estadoReproductivo: 'entero' as Paciente['estadoReproductivo'],
    fechaNacimiento: '',
    color: '',
    chip: '',
    origen: '',
    notasGenerales: '',
    propietarioNombre: '',
    propietarioTelefono: '',
    propietarioWhatsapp: '',
    propietarioEmail: '',
  });

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
            const [consData, vacData] = await Promise.all([
              fetchConsultasPorPaciente(id),
              listarVacunasPaciente(id),
            ]);
            setConsultasPaciente(consData || []);
            setVacunasCount(vacData.length);
            setVacunasAlDia(vacData.filter(v => v.estado === 'al_dia').length);
          } catch (e) {
            console.error('Error loading sub-resources', e);
            setConsultasPaciente([]);
          }
        }
      } finally {
        setLoadingGeneral(false);
      }
    };
    loadData();
  }, [fetchConsultasPorPaciente, getPaciente, id]);

  // Sync with Global Topbar (Level 3 Patient Name & Species)
  useEffect(() => {
    if (paciente) {
      window.__currentPaciente = { nombre: paciente.nombre, especie: paciente.especie };
      window.dispatchEvent(new Event('current-paciente-changed'));
    }
    return () => {
      window.__currentPaciente = null;
      window.dispatchEvent(new Event('current-paciente-changed'));
    };
  }, [paciente]);

  if (loadingGeneral) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto"></div>
          <p className="text-sm font-semibold text-slate-500 animate-pulse">Cargando expediente clínico...</p>
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
        <Link to="/pacientes" className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-bold">
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
      hc: p.numeroHC || '',
    }));

  const hasPesoData = evolucionDatos.some(d => d.peso !== null);
  const formatPesoTooltip = (value: unknown) => [`${value} kg`, 'Peso'];

  const handleOpenEdit = () => {
    setFotoFile(null);
    setFotoPreview(null);
    setEditForm({
      nombre: paciente?.nombre || '',
      sexo: paciente?.sexo || 'macho',
      estadoReproductivo: paciente?.estadoReproductivo || 'entero',
      fechaNacimiento: paciente?.fechaNacimiento || '',
      color: paciente?.color || '',
      chip: paciente?.chip || '',
      origen: paciente?.origen || '',
      notasGenerales: paciente?.notasGenerales || '',
      propietarioNombre: paciente?.propietario?.nombre || '',
      propietarioTelefono: paciente?.propietario?.telefono || '',
      propietarioWhatsapp: paciente?.propietario?.whatsapp || '',
      propietarioEmail: paciente?.propietario?.email || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !paciente) return;
    try {
      let currentFotoUrl = paciente.foto || undefined;
      if (fotoFile) {
        const orgId = me?.orgId || 'no-org';
        const fotoPath = buildPatientPhotoStoragePath(orgId, id, fotoFile);
        const storageRef = ref(storage, fotoPath);
        const uploadResult = await uploadBytes(storageRef, fotoFile);
        currentFotoUrl = await getDownloadURL(uploadResult.ref);
      }

      const updated = await actualizarPaciente(id, {
        nombre: editForm.nombre.trim(),
        sexo: editForm.sexo,
        estadoReproductivo: editForm.estadoReproductivo,
        fechaNacimiento: editForm.fechaNacimiento || undefined,
        color: editForm.color.trim() || undefined,
        chip: editForm.chip.trim() || undefined,
        origen: editForm.origen.trim() || undefined,
        notasGenerales: editForm.notasGenerales.trim() || undefined,
        foto: currentFotoUrl,
        propietario: {
          nombre: editForm.propietarioNombre.trim(),
          telefono: editForm.propietarioTelefono.trim(),
          whatsapp: editForm.propietarioWhatsapp.trim() || undefined,
          email: editForm.propietarioEmail.trim() || undefined,
        },
      });
      if (updated) {
        setPaciente(prev => {
          if (!prev) return null;
          return {
            ...prev,
            nombre: editForm.nombre.trim(),
            sexo: editForm.sexo,
            estadoReproductivo: editForm.estadoReproductivo,
            fechaNacimiento: editForm.fechaNacimiento || undefined,
            color: editForm.color.trim() || undefined,
            chip: editForm.chip.trim() || undefined,
            origen: editForm.origen.trim() || undefined,
            notasGenerales: editForm.notasGenerales.trim() || undefined,
            foto: currentFotoUrl,
            propietario: {
              nombre: editForm.propietarioNombre.trim(),
              telefono: editForm.propietarioTelefono.trim(),
              whatsapp: editForm.propietarioWhatsapp.trim() || undefined,
              email: editForm.propietarioEmail.trim() || undefined,
            },
          };
        });
        setIsEditModalOpen(false);
      }
    } catch (err) {
      console.error('Error updating patient:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Vistas Condicionales */}
      {activeTab === 'perfil' && (
        <div className="space-y-6">
          {/* Dashboard de Métricas */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="metric-tile p-4 flex items-start gap-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <div className="p-2 bg-teal-50 text-accent rounded-xl shrink-0">
                <Scale className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Peso Actual</span>
                <span className="text-lg font-black text-slate-800">
                  {paciente.ultimoPeso ? `${paciente.ultimoPeso} kg` : 'No reg.'}
                </span>
              </div>
            </div>
            <div className="metric-tile p-4 flex items-start gap-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Edad</span>
                <span className="text-lg font-black text-slate-800">{getAge(paciente.fechaNacimiento)}</span>
              </div>
            </div>
            <div className="metric-tile p-4 flex items-start gap-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Consultas</span>
                <span className="text-lg font-black text-slate-800">{consultasPaciente.length}</span>
              </div>
            </div>
            <div className="metric-tile p-4 flex items-start gap-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vacunas</span>
                <span className="text-lg font-black text-slate-800">{vacunasAlDia} / {vacunasCount} al día</span>
              </div>
            </div>
          </div>

          {/* Gráfica de peso clínica */}
          {hasPesoData && (
            <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 mb-6 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                Evolución de Peso
              </h3>
              <div style={{ width: '100%', height: 220 }}>
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
                    <Line type="monotone" dataKey="peso" stroke={BRAND.accent} strokeWidth={3} dot={{ fill: BRAND.accent, strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Información en dos columnas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Col 1: Datos Fisiológicos */}
            <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-800 text-sm">Datos Fisiológicos</h3>
                <button
                  onClick={handleOpenEdit}
                  className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Editar
                </button>
              </div>

              {paciente.foto && (
                <div className="flex justify-center pb-2">
                  <img
                    src={paciente.foto}
                    alt={paciente.nombre}
                    className="h-32 w-32 rounded-2xl object-cover border border-slate-100 shadow-sm"
                  />
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-1 border-b border-slate-50/50">
                  <span className="text-slate-400 font-medium">Sexo</span>
                  <span className="font-bold text-slate-700 capitalize">{paciente.sexo}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50/50">
                  <span className="text-slate-400 font-medium">¿Castrado?</span>
                  <span className="font-bold text-slate-700">{paciente.estadoReproductivo === 'entero' ? 'No' : 'Sí'}</span>
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
                {paciente.ultimaTalla && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-50/50">
                    <span className="text-slate-400 font-medium">Última Talla</span>
                    <span className="bg-accent/10 text-accent font-bold px-2 py-0.5 rounded-lg">{paciente.ultimaTalla} cm</span>
                  </div>
                )}
              </div>
            </div>

            {/* Col 2: Propietario e Alertas */}
            <div className="space-y-6">
              <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2">Información del Propietario</h3>
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
                    <div className="p-2 bg-accent/5 rounded-xl text-accent">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Teléfono</div>
                      <a href={`tel:${paciente.propietario.telefono}`} className="text-sm font-bold text-accent hover:underline">
                        {paciente.propietario.telefono}
                      </a>
                      {paciente.propietario.whatsapp && (
                        <span className="text-xs text-slate-500 block">WhatsApp: {paciente.propietario.whatsapp}</span>
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
                        <a href={`mailto:${paciente.propietario.email}`} className="text-sm font-bold text-slate-700 hover:underline truncate block max-w-[200px]">
                          {paciente.propietario.email}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notas Clínicas */}
              {paciente.notasGenerales && (
                <div className="space-y-3 rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
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

          </div>
        </div>
      )}

      {activeTab === 'vacunas' && id && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <VacunasPanel pacienteId={id} pacienteEspecie={paciente.especie} />
        </div>
      )}

      {activeTab === 'consultas' && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-6">
            <h3 className="font-bold text-slate-800 text-sm">Historial de Consultas Clínicas</h3>
            <Link
              to={`/pacientes/${paciente.id}/consultas/nueva`}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-accent-strong"
            >
              <Plus className="h-4 w-4" />
              Nueva Consulta
            </Link>
          </div>

          {consultasPaciente.length > 0 && (
            <div className="flex flex-wrap items-end gap-3 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-accent outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:border-accent outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleFilter}
                  className="px-4 py-2 bg-accent hover:bg-accent-strong text-white text-sm font-bold rounded-lg transition-colors"
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
                  <span className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
                    consulta.estado === 'aprobada'
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
                            <span className="text-xs font-bold text-accent">#{consulta.numeroHC}</span>
                          </>
                        )}
                      </div>

                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        consulta.estado === 'aprobada'
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
                        className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
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
      )}

      {/* Otros Pacientes Carousel Section */}
      {otrosPacientes.length > 0 && (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-3 mb-4">Otros Pacientes</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {otrosPacientes.slice(0, 10).map((p) => (
              <Link
                key={p.id}
                to={`/pacientes/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 hover:border-accent/30 rounded-xl transition-all shrink-0 min-w-[180px]"
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

      {/* 2. Modal de Edición */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-up">
            
            <div className="flex justify-between items-center p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-black text-slate-800">Editar Expediente</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
              
              {/* Bloque: Datos del Paciente */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 pb-1">🐾 Mascota</h3>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Foto de la Mascota</label>
                  <div className="flex items-center gap-4">
                    {fotoPreview || paciente?.foto ? (
                      <img
                        src={fotoPreview || paciente?.foto || undefined}
                        alt="Vista previa"
                        className="h-14 w-14 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                        <span className="text-xl">🐾</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFotoChange}
                      className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-accent/10 file:text-accent hover:file:bg-accent/20 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre</label>
                  <input
                    type="text"
                    required
                    value={editForm.nombre}
                    onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
                    className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Sexo</label>
                    <select
                      value={editForm.sexo}
                      onChange={e => setEditForm({ ...editForm, sexo: e.target.value as Paciente['sexo'] })}
                      className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none"
                    >
                      <option value="macho">Macho</option>
                      <option value="hembra">Hembra</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">¿Castrado?</label>
                    <select
                      value={editForm.estadoReproductivo === 'entero' ? 'entero' : 'esterilizado'}
                      onChange={e => setEditForm({ ...editForm, estadoReproductivo: e.target.value as Paciente['estadoReproductivo'] })}
                      className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none"
                    >
                      <option value="esterilizado">Sí</option>
                      <option value="entero">No</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha Nacimiento</label>
                    <input
                      type="date"
                      value={editForm.fechaNacimiento}
                      onChange={e => setEditForm({ ...editForm, fechaNacimiento: e.target.value })}
                      className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Color/Pelaje</label>
                    <input
                      type="text"
                      value={editForm.color}
                      onChange={e => setEditForm({ ...editForm, color: e.target.value })}
                      className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Microchip</label>
                    <input
                      type="text"
                      value={editForm.chip}
                      onChange={e => setEditForm({ ...editForm, chip: e.target.value })}
                      className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Origen</label>
                    <input
                      type="text"
                      value={editForm.origen}
                      onChange={e => setEditForm({ ...editForm, origen: e.target.value })}
                      className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Notas Clínicas / Alergias</label>
                  <textarea
                    rows={2}
                    value={editForm.notasGenerales}
                    onChange={e => setEditForm({ ...editForm, notasGenerales: e.target.value })}
                    className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none resize-none"
                  />
                </div>
              </div>

              {/* Bloque: Datos del Propietario */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 pb-1">👤 Propietario</h3>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={editForm.propietarioNombre}
                    onChange={e => setEditForm({ ...editForm, propietarioNombre: e.target.value })}
                    className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      required
                      value={editForm.propietarioTelefono}
                      onChange={e => setEditForm({ ...editForm, propietarioTelefono: e.target.value })}
                      className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">WhatsApp</label>
                    <input
                      type="tel"
                      value={editForm.propietarioWhatsapp}
                      onChange={e => setEditForm({ ...editForm, propietarioWhatsapp: e.target.value })}
                      className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={editForm.propietarioEmail}
                    onChange={e => setEditForm({ ...editForm, propietarioEmail: e.target.value })}
                    className="w-full px-3 py-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-accent focus:bg-white outline-none"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 text-sm font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold text-white bg-accent hover:bg-accent-strong rounded-xl transition-all shadow-md shadow-accent/15"
                >
                  <Save className="h-4 w-4" />
                  Guardar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetallePaciente;
export { DetallePaciente };
