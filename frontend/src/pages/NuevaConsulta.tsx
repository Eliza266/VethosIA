import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePacientes } from '../hooks/usePacientes';
import { useConsultas } from '../hooks/useConsultas';
import type { Paciente, SignosVitales } from '../types';
import AudioRecorder from '../components/AudioRecorder';
import { ArrowLeft, AlertCircle, Sparkles, HelpCircle, FileText } from 'lucide-react';
import { getErrorMessage } from '../lib/errors';

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

const NuevaConsulta: React.FC = () => {
  const { pacienteId } = useParams<{ pacienteId: string }>();
  const [searchParams] = useSearchParams();
  const citaId = searchParams.get('citaId') ?? undefined;
  const navigate = useNavigate();

  const { getPaciente, loading: loadingPaciente } = usePacientes();
  const { crearConsulta, actualizarConsulta, procesarAudioConsulta, error: apiError } = useConsultas();

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualForm, setManualForm] = useState<ManualConsultaForm>(EMPTY_MANUAL_FORM);
  const [progressText, setProgressText] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0F6E56] border-t-transparent"></div>
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
        <Link to="/pacientes" className="px-4 py-2.5 rounded-xl bg-[#0F6E56] text-white text-sm font-bold">
          Volver a Pacientes
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Link
          to={`/pacientes/${paciente.id}`}
          className="p-2 bg-white rounded-xl border border-slate-100 hover:border-slate-200 text-slate-500 hover:text-[#0F6E56] transition-colors"
          title="Volver al expediente"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">Nueva Consulta Automática</h1>
          <p className="text-xs text-slate-500">
            Paciente: <span className="font-semibold text-slate-700">{paciente.nombre}</span>
            {paciente.especie && <span className="ml-1 text-slate-400">· {paciente.especie}</span>}
          </p>
        </div>
      </div>

      {/* Error alert */}
      {(error || apiError) && (
        <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm p-4 rounded-xl border border-red-100">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div><span className="font-bold">Error:</span> {error || apiError}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="mb-3">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              Grabación de Audio
            </h2>
          </div>
          {isProcessing ? (
            <div className="bg-white border border-slate-100 p-8 rounded-2xl shadow-sm text-center space-y-4">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0F6E56] border-t-transparent mx-auto"></div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Procesando Consulta</h3>
                <p className="text-xs text-slate-500 mt-1">{progressText}</p>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mt-4 overflow-hidden">
                <div 
                  className="bg-[#0F6E56] h-2.5 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${progressPct}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <AudioRecorder
              onAudioRecorded={handleAudioRecorded}
              isProcessing={isProcessing}
              onManualFallback={() => setManualVisible(true)}
            />
          )}

          {manualVisible && !isProcessing && (
            <form
              aria-label="Consulta manual"
              onSubmit={handleManualSubmit}
              className="mt-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F6E56]/10 text-[#0F6E56]">
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
                    className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15"
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Peso kg
                    <input
                      inputMode="decimal"
                      value={manualForm.peso}
                      onChange={setManualField('peso')}
                      className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Talla cm
                    <input
                      inputMode="decimal"
                      value={manualForm.talla}
                      onChange={setManualField('talla')}
                      className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Temperatura
                    <input
                      inputMode="decimal"
                      value={manualForm.temperatura}
                      onChange={setManualField('temperatura')}
                      className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Condicion corporal
                    <select
                      value={manualForm.condicionCorporal}
                      onChange={setManualField('condicionCorporal')}
                      className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15"
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
                      className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-slate-600">
                    Frecuencia respiratoria
                    <input
                      inputMode="numeric"
                      value={manualForm.frecuenciaRespiratoria}
                      onChange={setManualField('frecuenciaRespiratoria')}
                      className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none transition focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15"
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
                      className="resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none transition focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15"
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
                  className="rounded-lg bg-[#0F6E56] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0c5945] disabled:opacity-50"
                >
                  {manualSaving ? 'Guardando...' : 'Guardar borrador manual'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Instructions Card */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-50 pb-2">
            <HelpCircle className="h-4 w-4 text-[#0F6E56]" />
            ¿Cómo funciona?
          </h3>
          <ul className="space-y-3.5 text-xs text-slate-500">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-[#0F6E56] shrink-0">1</span>
              <span>Presiona el micrófono para iniciar la grabación de audio.</span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-[#0F6E56] shrink-0">2</span>
              <span>Menciona el motivo de consulta, prioridad, signos vitales, hallazgos y plan de tratamiento.</span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-[#0F6E56] shrink-0">3</span>
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
