import React, { useEffect, useState } from 'react';
import { useTourGuide } from '../hooks/useTourGuide';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePacientes } from '../hooks/usePacientes';
import { useConsultas } from '../hooks/useConsultas';
import type { Paciente, SignosVitales } from '../types';
import AudioRecorder from '../components/AudioRecorder';
import { AlertCircle, Sparkles, HelpCircle, FileText, Search } from 'lucide-react';
import { getSpeciesEmoji } from '../lib/navModel';
import { PageHeader } from '../components/ui/Primitives';
import { getErrorMessage } from '../lib/errors';
import { useAuth } from '../features/auth/hooks';
import { useBrigadas } from '../hooks/useBrigadas';
import { registrarAtencionBrigada } from '../features/brigadas/api';

type ManualConsultaForm = {
  motivo: string;
  subjetivo: string;
  objetivo: string;
  analisis: string;
  plan: string;
  peso: string;
  talla: string;
  temperatura: string;
  frecuenciaCardiaca: string;
  frecuenciaRespiratoria: string;
  condicionCorporal: string;
};

const EMPTY_MANUAL_FORM: ManualConsultaForm = {
  motivo: '',
  subjetivo: '',
  objetivo: '',
  analisis: '',
  plan: '',
  peso: '',
  talla: '',
  temperatura: '',
  frecuenciaCardiaca: '',
  frecuenciaRespiratoria: '',
  condicionCorporal: '',
};

const parseOptionalNumber = (value: string): number | undefined => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return undefined;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const parseCondicionCorporal = (value: string): SignosVitales['condicionCorporal'] | undefined => {
  const numeric = Number(value);
  return [1, 2, 3, 4, 5].includes(numeric)
    ? (numeric as SignosVitales['condicionCorporal'])
    : undefined;
};

const buildSignosVitales = (form: ManualConsultaForm): SignosVitales => ({
  peso: parseOptionalNumber(form.peso),
  talla: parseOptionalNumber(form.talla),
  temperatura: parseOptionalNumber(form.temperatura),
  frecuenciaCardiaca: parseOptionalNumber(form.frecuenciaCardiaca),
  frecuenciaRespiratoria: parseOptionalNumber(form.frecuenciaRespiratoria),
  condicionCorporal: parseCondicionCorporal(form.condicionCorporal),
});

const hasManualClinicalContent = (form: ManualConsultaForm): boolean =>
  [
    form.motivo,
    form.subjetivo,
    form.objetivo,
    form.analisis,
    form.plan,
    form.peso,
    form.talla,
    form.temperatura,
    form.frecuenciaCardiaca,
    form.frecuenciaRespiratoria,
    form.condicionCorporal,
  ].some((value) => value.trim().length > 0);

const TOUR_STEPS_NUEVA_CONSULTA = [
  { element: '[data-tour="nueva-consulta-mic"]', popover: { title: 'Grabar consulta', description: 'Presiona aquí para empezar a grabar. Al iniciar escucharás un aviso hablado de consentimiento de datos. Habla con naturalidad: motivo, hallazgos, diagnóstico y plan. Si el micrófono falla, puedes llenar el formulario manual en su lugar.' } },
  { element: '[data-tour="nueva-consulta-bloques"]', popover: { title: 'Bloques de audio', description: 'Cada bloque dura máximo 20 minutos, con una alerta sonora poco antes del corte. Si necesitas más tiempo, el bloque se cierra solo y puedes seguir grabando otro bloque sin perder lo ya grabado.' } },
  { element: '[data-tour="nueva-consulta-info"]', popover: { title: 'IA automática', description: 'Cuando termines, la IA transcribe todo y arma la historia clínica en formato SOAP: signos vitales, diagnóstico y medicamentos sugeridos. Todo queda editable antes de aprobar.' } },
];

const NuevaConsulta: React.FC = () => {
  const { pacienteId } = useParams<{ pacienteId: string }>();
  const [searchParams] = useSearchParams();
  const citaId = searchParams.get('citaId') ?? undefined;
  const navigate = useNavigate();

  const { getPaciente, pacientes, loading: loadingPaciente } = usePacientes();
  const { crearConsulta, actualizarConsulta, procesarAudioConsulta, error: apiError } = useConsultas();
  const { user } = useAuth();
  const { brigadas } = useBrigadas();
  useTourGuide('nueva-consulta', TOUR_STEPS_NUEVA_CONSULTA);

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualForm, setManualForm] = useState<ManualConsultaForm>(EMPTY_MANUAL_FORM);
  const [progressText, setProgressText] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [brigadaSeleccionadaId, setBrigadaSeleccionadaId] = useState<string>('');
  const [buscarPaciente, setBuscarPaciente] = useState('');

  const hoyStr = (() => {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    const mm = String(hoy.getMonth() + 1).padStart(2, '0');
    const dd = String(hoy.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  })();

  const brigadasDeHoy = brigadas.filter((b) => {
    const esDeHoy = b.fecha === hoyStr;
    const esActiva = b.estado !== 'finalizada';
    const participa = user?.uid ? b.veterinarioIds?.includes(user.uid) : true;
    return esDeHoy && esActiva && participa;
  });

  const resultadosBusqueda = (() => {
    const q = buscarPaciente.trim().toLowerCase();
    if (!q || !paciente?.esPlaceholder) return [];
    return pacientes
      .filter((p): p is Paciente & { id: string } => !!p.id && !p.esPlaceholder && p.id !== pacienteId)
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.propietario?.nombre ?? '').toLowerCase().includes(q),
      )
      .slice(0, 6);
  })();

  const handleSeleccionarPacienteExistente = (idExistente: string) => {
    navigate(
      `/pacientes/${idExistente}/consultas/nueva${citaId ? `?citaId=${citaId}` : ''}`,
      { replace: true },
    );
  };

  useEffect(() => {
    const loadPaciente = async () => {
      if (pacienteId) {
        const data = await getPaciente(pacienteId);
        setPaciente(data);
      }
    };
    loadPaciente();
  }, [pacienteId, getPaciente]);

  const handleAudioRecorded = async (audioBlobs: Blob[]) => {
    if (!pacienteId) return;
    setIsProcessing(true);
    setError(null);
    setProgressText('Iniciando procesamiento...');
    setProgressPct(5);
    try {
      const id = await crearConsulta(pacienteId, citaId);
      if (!id) throw new Error('No se pudo crear la consulta.');

      if (brigadaSeleccionadaId) {
        try {
          await registrarAtencionBrigada(brigadaSeleccionadaId, {
            consultaId: id,
            pacienteId,
            motivo: 'Atención en brigada',
          });
        } catch (err) {
          console.error('Error al asociar consulta a la brigada:', err);
        }
      }
      
      const success = await procesarAudioConsulta(id, audioBlobs, (msg, pct) => {
        setProgressText(msg);
        setProgressPct(pct);
      });
      if (success) {
        setTimeout(() => {
          navigate(`/pacientes/${pacienteId}/consultas/${id}`);
        }, 1000);
      } else {
        throw new Error('El procesamiento del audio o SOAP falló.');
      }
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, 'Error durante el procesamiento. Por favor intenta de nuevo.'));
      setIsProcessing(false);
    }
  };

  const setManualField =
    (field: keyof ManualConsultaForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setManualForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pacienteId || manualSaving) return;
    if (!hasManualClinicalContent(manualForm)) {
      setError('Registra al menos un motivo, signo vital o campo SOAP para guardar el borrador.');
      setManualVisible(true);
      return;
    }

    setManualSaving(true);
    setError(null);
    try {
      const id = await crearConsulta(pacienteId, citaId);
      if (!id) throw new Error('No se pudo crear la consulta manual.');

      if (brigadaSeleccionadaId) {
        try {
          await registrarAtencionBrigada(brigadaSeleccionadaId, {
            consultaId: id,
            pacienteId,
            motivo: manualForm.motivo.trim() || 'Atención en brigada',
          });
        } catch (err) {
          console.error('Error al asociar consulta a la brigada:', err);
        }
      }

      const success = await actualizarConsulta(id, {
        motivo: manualForm.motivo.trim(),
        prioridad: 'rutina',
        signosVitales: buildSignosVitales(manualForm),
        soap: {
          subjetivo: manualForm.subjetivo.trim(),
          objetivo: manualForm.objetivo.trim(),
          analisis: manualForm.analisis.trim(),
          plan: manualForm.plan.trim(),
          medicamentosSugeridos: [],
          generadoPorIA: false,
        },
        diagnosticoEstructurado: [],
        estado: 'borrador',
      });
      if (!success) throw new Error('No se pudo guardar el borrador manual.');

      navigate(`/pacientes/${pacienteId}/consultas/${id}`);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, 'Error al guardar la consulta manual.'));
    } finally {
      setManualSaving(false);
    }
  };

  if (loadingPaciente) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
          <p className="text-xs text-slate-500 font-medium">Cargando datos del paciente...</p>
        </div>
      </div>
    );
  }

  if (!paciente) {
    return (
      <div className="max-w-md mx-auto text-center py-12 bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Paciente no encontrado</h3>
        <p className="text-sm text-slate-500 mb-6">No pudimos cargar la información del paciente para esta consulta.</p>
        <Link to="/pacientes" className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-bold">
          Volver a Pacientes
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <PageHeader
        breadcrumbs={[
          { label: 'Pacientes', to: '/pacientes' },
          { label: paciente.nombre, to: `/pacientes/${paciente.id}` },
          { label: 'Nueva consulta' },
        ]}
        title="Nueva Consulta Automática"
        description={`Paciente: ${paciente.nombre}${paciente.especie ? ` · ${paciente.especie}` : ''}`}
      />

      {/* Error alert */}
      {(error || apiError) && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm p-4 rounded-xl border border-red-100">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div><span className="font-bold">Error:</span> {error || apiError}</div>
        </div>
      )}

      {/* Recordatorio para consulta rapida: sin datos de paciente, la IA los detecta del audio,
          o se puede buscar y vincular un paciente ya existente antes de grabar. */}
      {paciente.esPlaceholder && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <Sparkles className="h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <span className="font-bold">Consulta rápida:</span> no elegiste un paciente antes de grabar.
              Si es una mascota ya registrada, búscala abajo. Si no, no olvides decir en voz alta el{' '}
              <b>nombre y especie de la mascota</b>, y el <b>nombre y teléfono del propietario</b> — la IA
              los detecta del audio para armar la ficha.
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
            <input
              type="text"
              value={buscarPaciente}
              onChange={(e) => setBuscarPaciente(e.target.value)}
              placeholder="Buscar paciente por nombre o dueño..."
              aria-label="Buscar paciente existente"
              className="w-full rounded-lg border border-amber-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </div>

          {resultadosBusqueda.length > 0 && (
            <ul className="grid gap-1.5">
              {resultadosBusqueda.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handleSeleccionarPacienteExistente(p.id)}
                    className="flex w-full items-center gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2 text-left text-sm transition-colors hover:border-accent hover:bg-accent/5"
                  >
                    <span className="text-lg shrink-0">{getSpeciesEmoji(p.especie)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-slate-800">{p.nombre}</span>
                      <span className="block truncate text-xs text-slate-500">
                        Dueño: {p.propietario?.nombre || 'Sin dato'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {buscarPaciente.trim() && resultadosBusqueda.length === 0 && (
            <p className="text-xs text-amber-700">No encontramos ningún paciente con ese nombre o dueño.</p>
          )}
        </div>
      )}

      {/* Selector de Brigada */}
      {brigadasDeHoy.length > 0 && (
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              ¿Esta consulta pertenece a una brigada? (Opcional)
            </span>
            <select
              value={brigadaSeleccionadaId}
              onChange={(e) => setBrigadaSeleccionadaId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm text-slate-700 bg-white border border-slate-200 rounded-xl focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
            >
              <option value="">Ninguna</option>
              {brigadasDeHoy.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre} ({b.ubicacion.ciudad})
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="mb-3" data-tour="nueva-consulta-bloques">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              Grabación de Audio
            </h2>
          </div>
          {isProcessing ? (
            <div className="bg-white border border-slate-100 p-8 rounded-2xl shadow-sm text-center space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto"></div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Procesando Consulta</h3>
                <p className="text-xs text-slate-500 mt-1">{progressText}</p>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mt-4 overflow-hidden">
                <div 
                  className="bg-accent h-2.5 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${progressPct}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <AudioRecorder
              onAudioRecorded={handleAudioRecorded}
              isProcessing={isProcessing}
              onManualFallback={() => setManualVisible(true)}
              data-tour="nueva-consulta-mic"
            />
          )}

          {manualVisible && !isProcessing && (
            <form
              aria-label="Consulta manual"
              onSubmit={handleManualSubmit}
              className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-800">Consulta manual</h2>
                  <p className="text-xs text-slate-500">Borrador SOAP editable</p>
                </div>
              </div>

              <div className="grid gap-3">
                <label className="grid gap-1 text-xs font-bold text-slate-600">
                  Motivo
                  <input
                    value={manualForm.motivo}
                    onChange={setManualField('motivo')}
                    className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Peso kg
                    <input
                      inputMode="decimal"
                      value={manualForm.peso}
                      onChange={setManualField('peso')}
                      className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Talla cm
                    <input
                      inputMode="decimal"
                      value={manualForm.talla}
                      onChange={setManualField('talla')}
                      className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Temperatura
                    <input
                      inputMode="decimal"
                      value={manualForm.temperatura}
                      onChange={setManualField('temperatura')}
                      className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Condicion corporal
                    <select
                      value={manualForm.condicionCorporal}
                      onChange={setManualField('condicionCorporal')}
                      className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    >
                      <option value="">Sin dato</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Frecuencia cardiaca
                    <input
                      inputMode="numeric"
                      value={manualForm.frecuenciaCardiaca}
                      onChange={setManualField('frecuenciaCardiaca')}
                      className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Frecuencia respiratoria
                    <input
                      inputMode="numeric"
                      value={manualForm.frecuenciaRespiratoria}
                      onChange={setManualField('frecuenciaRespiratoria')}
                      className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                </div>

                {(['subjetivo', 'objetivo', 'analisis', 'plan'] as const).map((field) => (
                  <label key={field} className="grid gap-1 text-xs font-bold text-slate-600">
                    {field === 'analisis' ? 'Analisis' : field.charAt(0).toUpperCase() + field.slice(1)}
                    <textarea
                      value={manualForm[field]}
                      onChange={setManualField(field)}
                      rows={3}
                      className="resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualVisible(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={manualSaving}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-accent-strong disabled:opacity-50"
                >
                  {manualSaving ? 'Guardando...' : 'Guardar borrador manual'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Instructions Card */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-4" data-tour="nueva-consulta-info">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-50 pb-2">
            <HelpCircle className="h-4 w-4 text-accent" />
            ¿Cómo funciona?
          </h3>
          <ul className="space-y-3.5 text-xs text-slate-500">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-accent shrink-0">1</span>
              <span>Presiona el micrófono para iniciar la grabación de audio.</span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-accent shrink-0">2</span>
              <span>Menciona el motivo de consulta, prioridad, signos vitales, hallazgos y plan de tratamiento.</span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-accent shrink-0">3</span>
              <span>Presiona el botón de detener al terminar.</span>
            </li>
            <li className="flex gap-2 font-medium text-slate-700">
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Nuestra IA extraerá todos los datos clínicos y generará el registro SOAP automáticamente.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NuevaConsulta;
export { NuevaConsulta };
