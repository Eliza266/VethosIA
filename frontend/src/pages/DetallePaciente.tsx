import React, { useEffect, useMemo, useState } from 'react';
import { useTourGuide } from '../hooks/useTourGuide';
import { useParams, Link, useLocation } from 'react-router-dom';
import { usePacientes } from '../hooks/usePacientes';
import { useConsultas } from '../hooks/useConsultas';
import { VacunasPanel } from '../features/vacunas/VacunasPanel';
import { construirEvolucionClinica } from '../features/pacientes/evolucion';
import { listarVacunasPaciente, type Vacuna } from '../features/vacunas/api';
import type { Paciente, Consulta } from '../types';
import { storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { buildPatientPhotoStoragePath } from '../lib/patientPhotoStorage';
import { BRAND } from '../lib/theme';
import { useMe } from '../features/tenant/hooks';
import { PAIS_DEFAULT, splitPhone, joinPhone, type PaisIndicativo } from '../lib/phone';
import PhoneInput from '../components/ui/PhoneInput';
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
  X,
  Save,
  Stethoscope,
  Syringe,
  CheckCircle2,
} from 'lucide-react';

/** Panel deslizante desde la derecha (ej. "todas las consultas" / "todas las vacunas")
 * para no obligar a salir del perfil del paciente a ver el historial completo. */
const SidePanel: React.FC<{ titulo: string; onClose: () => void; children: React.ReactNode }> = ({
  titulo,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-[150] flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
    <div
      className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl"
      style={{ animation: 'toastIn 0.28s ease-out forwards' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
        <h2 className="text-base font-black text-slate-800">{titulo}</h2>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Cerrar panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const parseLocalDate = (dateString: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString);
  if (!match) return new Date(dateString);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

const TOUR_STEPS_PACIENTE_DETALLE = [
  { element: '[data-tour="paciente-info"]', popover: { title: 'Información del paciente', description: 'Aquí ves toda la información del paciente: datos fisiológicos, historial de consultas, vacunas y evolución de peso.' } },
  { element: '[data-tour="paciente-editar"]', popover: { title: 'Editar datos', description: 'Actualiza aquí los datos de la mascota y del propietario: si cambia de teléfono, correo o dirección, edítalo desde este botón. Los cambios quedan reflejados de inmediato en nuevas consultas y envíos.' } },
  { element: '[data-tour="paciente-nueva-consulta"]', popover: { title: 'Nueva consulta', description: 'Inicia una consulta nueva para este paciente, ya con su ficha preseleccionada.' } },
];

const DetallePaciente: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const activeTab = queryParams.get('tab') || 'perfil';

  const { getPaciente, actualizarPaciente } = usePacientes();
  const { fetchConsultasPorPaciente } = useConsultas();
  const { data: me } = useMe();
  useTourGuide('paciente-detalle', TOUR_STEPS_PACIENTE_DETALLE);

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

  // Vacunas del paciente (lista completa: sirve tanto para las stats como para la
  // vista previa compacta y el panel de "ver todas").
  const [vacunas, setVacunas] = useState<Vacuna[]>([]);
  const vacunasCount = vacunas.length;
  const vacunasAlDia = vacunas.filter((v) => v.estado === 'al_dia').length;

  // "Ver todas" abre el panel lateral con el historial completo, sin salir del perfil.
  const [panelAbierto, setPanelAbierto] = useState<'consultas' | 'vacunas' | null>(null);

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
    propietarioEmail: '',
  });
  const [telPais, setTelPais] = useState<PaisIndicativo>(PAIS_DEFAULT);
  const [telNumero, setTelNumero] = useState('');
  const [waPais, setWaPais] = useState<PaisIndicativo>(PAIS_DEFAULT);
  const [waNumero, setWaNumero] = useState('');

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
            setVacunas(vacData || []);
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
      propietarioEmail: paciente?.propietario?.email || '',
    });
    const tel = splitPhone(paciente?.propietario?.telefono);
    setTelPais(tel.pais);
    setTelNumero(tel.numero);
    const wa = splitPhone(paciente?.propietario?.whatsapp);
    setWaPais(wa.pais);
    setWaNumero(wa.numero);
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
          telefono: joinPhone(telPais, telNumero),
          whatsapp: joinPhone(waPais, waNumero) || undefined,
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
              telefono: joinPhone(telPais, telNumero),
              whatsapp: joinPhone(waPais, waNumero) || undefined,
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
    <div className="space-y-5 animate-fade-in" data-tour="paciente-info">
      {/* 1. Vistas Condicionales */}
      {activeTab === 'perfil' && (
        <div className="space-y-5">
          {/* Fila 1 (escritorio): encabezado del paciente (mas ancho, foto grande) + Evolucion de Peso al lado. */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* Encabezado del paciente: foto, nombre y datos clave de un vistazo. */}
            <div className={`flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm ${hasPesoData ? 'md:col-span-2' : 'md:col-span-3'}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  {paciente.foto ? (
                    <img
                      src={paciente.foto}
                      alt={paciente.nombre}
                      className="h-24 w-24 shrink-0 rounded-2xl object-cover border border-slate-100 shadow-sm"
                    />
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-4xl border border-slate-100">
                      {getSpeciesEmoji(paciente.especie)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="truncate text-2xl font-black text-slate-900">{paciente.nombre}</h1>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-slate-500">
                      <span className="capitalize">{paciente.sexo}</span>
                      {paciente.estadoReproductivo !== 'entero' && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Castrado</span>
                      )}
                      <span>•</span>
                      <span>{getAge(paciente.fechaNacimiento)}</span>
                      <span>•</span>
                      <span>{paciente.ultimoPeso ? `${paciente.ultimoPeso} kg` : 'Peso no reg.'}</span>
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          vacunasCount > 0 && vacunasAlDia === vacunasCount
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {vacunasCount === 0 ? 'Sin vacunas' : `Vacunas ${vacunasAlDia}/${vacunasCount} al día`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={handleOpenEdit}
                    data-tour="paciente-editar"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-bold text-slate-600 transition-all hover:border-accent hover:text-accent"
                  >
                    <Edit2 className="h-4 w-4" />
                    Editar
                  </button>
                  <Link
                    to={`/pacientes/${paciente.id}/consultas/nueva`}
                    data-tour="paciente-nueva-consulta"
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-accent-strong"
                  >
                    <Stethoscope className="h-4 w-4" />
                    Crear consulta
                  </Link>
                </div>
              </div>
            </div>

            {/* Gráfica de peso clínica */}
            {hasPesoData && (
              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm md:col-span-1">
                <h3 className="mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-2 text-sm font-bold text-slate-800">
                  <TrendingUp className="h-3.5 w-3.5 text-accent" />
                  Evolución de Peso
                </h3>
                <div style={{ width: '100%', height: 150 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolucionDatos} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="fecha" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} width={26} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={formatPesoTooltip}
                        labelStyle={{ fontWeight: 'bold', color: '#334155' }}
                      />
                      <Line type="monotone" dataKey="peso" stroke={BRAND.accent} strokeWidth={2} dot={{ fill: BRAND.accent, strokeWidth: 2, r: 3 }} activeDot={{ r: 5 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Información en dos columnas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Col 1: Datos Fisiológicos */}
            <div className="space-y-2.5 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
              <h3 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-800">Datos Fisiológicos</h3>

              <div className="space-y-2 text-sm">
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
            <div className="space-y-5">
              <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                <h3 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-800">Información del Propietario</h3>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="font-bold text-slate-700">{paciente.propietario.nombre}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <a href={`tel:${paciente.propietario.telefono}`} className="font-bold text-accent hover:underline">
                    {paciente.propietario.telefono}
                  </a>
                  {paciente.propietario.whatsapp && (
                    <span className="text-xs text-slate-400">· WhatsApp {paciente.propietario.whatsapp}</span>
                  )}
                </div>
                {paciente.propietario.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <a href={`mailto:${paciente.propietario.email}`} className="truncate font-bold text-slate-700 hover:underline">
                      {paciente.propietario.email}
                    </a>
                  </div>
                )}
              </div>

              {/* Notas Clínicas */}
              {paciente.notasGenerales && (
                <div className="space-y-2.5 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
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

          {/* Fila 2 (escritorio): Historial de Consultas y Vacunas lado a lado. */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* Vista previa de Consultas: ultimas 3, con acceso al historial completo en panel lateral. */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">Historial de Consultas ({consultasPaciente.length})</h3>
              {consultasPaciente.length > 3 && (
                <button
                  onClick={() => setPanelAbierto('consultas')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                >
                  Ver todas
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {consultasPaciente.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">No hay consultas registradas en este expediente.</p>
            ) : (
              <div className="space-y-2">
                {consultasPaciente.slice(0, 3).map((consulta) => (
                  <Link
                    key={consulta.id}
                    to={`/pacientes/${paciente.id}/consultas/${consulta.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/30 p-3 transition-all hover:border-accent/30 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">
                          {new Date(consulta.fechaHora).toLocaleDateString()}
                        </span>
                        {consulta.numeroHC && <span className="text-xs font-bold text-accent">#{consulta.numeroHC}</span>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{consulta.motivo || consulta.soap?.subjetivo || 'Sin motivo registrado'}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        consulta.estado === 'aprobada'
                          ? 'bg-emerald-50 text-emerald-700'
                          : consulta.estado === 'procesando'
                            ? 'bg-amber-50 text-amber-700'
                            : consulta.estado === 'error'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {consulta.estado === 'aprobada' ? 'Completado' : consulta.estado === 'procesando' ? 'Procesando' : consulta.estado === 'error' ? 'Error' : 'Borrador'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Vista previa de Vacunas: al dia/proximas/vencidas, con acceso al panel de gestion completo. */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">Vacunas ({vacunasCount})</h3>
              <button
                onClick={() => setPanelAbierto('vacunas')}
                className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
              >
                Ver todas / Agregar
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {vacunas.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">No hay vacunas registradas todavía.</p>
            ) : (
              <div className="space-y-2">
                {vacunas.slice(0, 3).map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/30 p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Syringe className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate text-xs font-bold text-slate-700">{v.nombre}</span>
                      {v.proximaDosis && (
                        <span className="shrink-0 text-[10px] text-slate-400">próx. {new Date(v.proximaDosis).toLocaleDateString()}</span>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        v.estado === 'al_dia'
                          ? 'bg-emerald-50 text-emerald-700'
                          : v.estado === 'proxima_a_vencer'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {v.estado === 'al_dia' ? 'Al día' : v.estado === 'proxima_a_vencer' ? 'Próxima' : 'Vencida'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* Panel lateral: historial completo de consultas */}
      {panelAbierto === 'consultas' && (
        <SidePanel titulo="Historial de Consultas" onClose={() => setPanelAbierto(null)}>
          <div className="mb-4 flex justify-end">
            <Link
              to={`/pacientes/${paciente.id}/consultas/nueva`}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-accent-strong"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva Consulta
            </Link>
          </div>

          {consultasPaciente.length > 0 && (
            <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-accent"
                />
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handleFilter}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-accent-strong"
                >
                  Filtrar
                </button>
                {(fechaDesde || fechaHasta) && (
                  <button
                    onClick={handleClearFilter}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          )}

          {consultasFiltradas.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm">
                {consultasPaciente.length === 0
                  ? 'No hay consultas registradas en este expediente.'
                  : 'No hay consultas en el rango de fechas seleccionado.'}
              </p>
            </div>
          ) : (
            <div className="relative ml-2 space-y-6 border-l border-slate-100 pl-5">
              {consultasFiltradas.map((consulta) => (
                <div key={consulta.id} className="relative">
                  <span
                    className={`absolute -left-[27px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white ${
                      consulta.estado === 'aprobada'
                        ? 'bg-emerald-500'
                        : consulta.estado === 'procesando'
                          ? 'bg-amber-500 animate-pulse'
                          : consulta.estado === 'error'
                            ? 'bg-red-500'
                            : 'bg-slate-400'
                    }`}
                  />
                  <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-3">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-700">{new Date(consulta.fechaHora).toLocaleDateString()}</span>
                        {consulta.numeroHC && <span className="text-xs font-bold text-accent">#{consulta.numeroHC}</span>}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          consulta.estado === 'aprobada'
                            ? 'bg-emerald-50 text-emerald-700'
                            : consulta.estado === 'procesando'
                              ? 'bg-amber-50 text-amber-700'
                              : consulta.estado === 'error'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {consulta.estado === 'aprobada' ? 'Completado' : consulta.estado === 'procesando' ? 'Procesando con IA' : consulta.estado === 'error' ? 'Error' : 'Borrador'}
                      </span>
                    </div>
                    {consulta.soap ? (
                      <p className="truncate text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">S:</span> {consulta.soap.subjetivo}
                      </p>
                    ) : (
                      <p className="text-xs italic text-slate-400">
                        {consulta.estado === 'procesando' ? 'La IA está generando la nota...' : 'Consulta clínica vacía.'}
                      </p>
                    )}
                    <div className="mt-2 flex justify-end border-t border-slate-100/50 pt-2">
                      <Link
                        to={`/pacientes/${paciente.id}/consultas/${consulta.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                      >
                        Ver consulta
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SidePanel>
      )}

      {/* Panel lateral: gestion completa de vacunas (crear/editar/aplicar) */}
      {panelAbierto === 'vacunas' && id && (
        <SidePanel titulo="Vacunas" onClose={() => setPanelAbierto(null)}>
          <VacunasPanel pacienteId={id} pacienteEspecie={paciente.especie} />
        </SidePanel>
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
                  <PhoneInput
                    id="editar-paciente-telefono"
                    label="Teléfono"
                    pais={telPais}
                    numero={telNumero}
                    onChangePais={setTelPais}
                    onChangeNumero={setTelNumero}
                  />
                  <PhoneInput
                    id="editar-paciente-whatsapp"
                    label="WhatsApp"
                    pais={waPais}
                    numero={waNumero}
                    onChangePais={setWaPais}
                    onChangeNumero={setWaNumero}
                  />
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
