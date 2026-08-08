import React, { useEffect, useMemo, useState } from 'react';
import { useTourGuide } from '../hooks/useTourGuide';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useConsultas } from '../hooks/useConsultas';
import { usePacientes } from '../hooks/usePacientes';
import { useAuth } from '../hooks/useAuth';
import { buscarPacienteCoincidente } from '../features/pacientes/matching';
import type {
  Consulta,
  DiagnosticoEstructurado,
  Paciente,
  SOAP,
  Veterinario,
  MedicamentoSugerido,
} from '../types';
import SoapViewer from '../components/SoapViewer';
import { ArrowLeft, AlertCircle, AlertTriangle, Sparkles, Upload } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getErrorMessage } from '../lib/errors';
import { getFeatureFlags } from '../lib/featureFlags';
import { joinPhone } from '../lib/phone';
import { obtenerMe } from '../features/tenant/api';
import { apiClient } from '../lib/apiClient';
import {
  renderHistoriaClinicaPDF,
  type DatosVetPDF,
  type HistoriaClinicaPDFInput,
} from '../features/consultas/pdf';
import { construirUrlWhatsApp } from '../features/consultas/sharing';
import { obtenerUrlPDF, enviarHistorialEmail, subirExamenConsulta } from '../features/consultas/api';
import AudioRecorder from '../components/AudioRecorder';
import {
  PRIORIDAD_COLORS,
  PRIORIDAD_LABELS,
  type EditDataConsulta,
} from '../features/consultas/types';
import ConsultaActions from '../features/consultas/components/ConsultaActions';
import ColumnaIzquierda from '../features/consultas/components/ColumnaIzquierda';
import PanelMedicamentos from '../features/consultas/components/PanelMedicamentos';
import DiagnosticoEstructuradoPanel from '../features/consultas/components/DiagnosticoEstructuradoPanel';
import PacienteDetectadoBanner, {
  type DatosPacienteNuevo,
} from '../features/consultas/components/PacienteDetectadoBanner';
import { useToast, useConfirm } from '../components/ui/Primitives';

const TOUR_STEPS_CONSULTA_DETALLE = [
  { element: '[data-tour="consulta-soap"]', popover: { title: 'Nota SOAP', description: 'Aquí revisas la nota SOAP generada por la IA: Subjetivo, Objetivo, Análisis y Plan, más signos vitales, diagnóstico estructurado y medicamentos sugeridos. Puedes editar cualquier campo antes de aprobarla.' } },
  { element: '[data-tour="consulta-agregar-audio"]', popover: { title: 'Agregar más audio', description: 'Mientras la consulta siga en borrador, puedes grabar un bloque adicional (por ejemplo si olvidaste mencionar algo). La IA vuelve a generar el SOAP con todo el contenido, sin perder lo ya grabado.' } },
  { element: '[data-tour="consulta-examenes"]', popover: { title: 'Exámenes complementarios', description: 'Sube resultados de laboratorio o imágenes en PDF. La IA los lee y agrega un resumen clínico a la historia, aparte de la nota SOAP.' } },
  { element: '[data-tour="consulta-acciones"]', popover: { title: 'Compartir', description: 'Desde aquí generas el PDF y lo envías por correo (con el PDF adjunto) o por WhatsApp al dueño de la mascota.' } },
  { element: '[data-tour="consulta-aprobar"]', popover: { title: 'Aprobar', description: 'Cuando todo esté correcto, presiona Aprobar para cerrar la consulta. Después de aprobada, la nota ya no se puede editar.' } },
];

const DetalleConsulta: React.FC = () => {
  const { pacienteId, consultaId } = useParams<{ pacienteId: string; consultaId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { pacientes: todosPacientes, getPaciente, actualizarPaciente, vincularConsulta } = usePacientes();
  const {
    getConsulta,
    actualizarConsulta,
    aprobarConsulta,
    eliminarConsulta,
    agregarBloqueConsulta,
    error: apiError,
  } = useConsultas();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  useTourGuide('consulta-detalle', TOUR_STEPS_CONSULTA_DETALLE);

  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // perfilVet ahora tipado (antes era any): es el doc de veterinarios/{uid}
  const [perfilVet, setPerfilVet] = useState<Partial<Veterinario> | null>(null);

  const [editData, setEditData] = useState<EditDataConsulta>({
    motivo: '',
    prioridad: 'rutina',
    signosVitales: {},
  });
  const [isSavingDatos, setIsSavingDatos] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [mostrarAgregarAudio, setMostrarAgregarAudio] = useState(false);
  const [isAgregandoBloque, setIsAgregandoBloque] = useState(false);

  const [mostrarSubirExamen, setMostrarSubirExamen] = useState(false);
  const [examenNombre, setExamenNombre] = useState('');
  const [examenArchivo, setExamenArchivo] = useState<File | null>(null);
  const [isSubiendoExamen, setIsSubiendoExamen] = useState(false);

  const [isVinculandoPaciente, setIsVinculandoPaciente] = useState(false);
  const [isConfirmandoPacienteNuevo, setIsConfirmandoPacienteNuevo] = useState(false);

  useEffect(() => {
    const fetchVet = async () => {
      if (!user?.uid) return;
      try {
        if (getFeatureFlags().useApiCRUD) {
          const me = await obtenerMe();
          setPerfilVet({
            veterinaria: me.veterinaria ?? undefined,
            sede: me.sede ?? undefined,
            ciudad: me.ciudad ?? undefined,
            telefono: me.telefono ?? undefined,
            whatsapp: me.whatsapp ?? undefined,
            nombre: me.nombre ?? undefined,
            matriculaProfesional: me.matriculaProfesional ?? undefined,
          });
        } else {
          const vDoc = await getDoc(doc(db, 'veterinarios', user.uid));
          if (vDoc.exists()) setPerfilVet(vDoc.data() as Partial<Veterinario>);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchVet();
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      if (!consultaId || !pacienteId) return;
      setLoading(true);
      try {
        const consData = await getConsulta(consultaId);
        setConsulta(consData);
        if (consData) {
          setEditData({
            motivo: consData.motivo || '',
            prioridad: consData.prioridad || 'rutina',
            signosVitales: consData.signosVitales || {},
          });
        }
        setPaciente(await getPaciente(pacienteId));
      } catch (err) {
        console.error(err);
        setError(getErrorMessage(err, 'Error al cargar los detalles de la consulta.'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
    // getConsulta/getPaciente vienen de hooks y no son estables; los dejamos fuera
    // de deps a proposito para no recargar en loop (mismo comportamiento que antes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaId, pacienteId]);

  useEffect(() => {
    if (!consultaId || consulta?.estado !== 'procesando') return;

    const interval = setInterval(async () => {
      try {
        const consData = await getConsulta(consultaId);
        if (consData) {
          setConsulta(consData);
          if (consData.estado !== 'procesando') {
            setEditData({
              motivo: consData.motivo || '',
              prioridad: consData.prioridad || 'rutina',
              signosVitales: consData.signosVitales || {},
            });
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Error polling consulta:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaId, consulta?.estado]);

  const handleSaveSoap = async (updatedSoap: SOAP): Promise<boolean> => {
    if (!consultaId) return false;
    try {
      const ok = await actualizarConsulta(consultaId, { soap: updatedSoap });
      if (ok) setConsulta((prev) => (prev ? { ...prev, soap: updatedSoap } : null));
      else throw new Error('No se pudo guardar la nota en la base de datos.');
      return ok;
    } catch (err) {
      console.error(err);
      toast(getErrorMessage(err, 'Error al actualizar la nota SOAP.'), 'error');
      return false;
    }
  };

  const handleAgregarBloque = async (audioBlobs: Blob[]) => {
    if (!consultaId || audioBlobs.length === 0) return;
    setIsAgregandoBloque(true);
    try {
      const ok = await agregarBloqueConsulta(consultaId, audioBlobs, consulta?.audioUrls ?? []);
      if (ok) {
        setConsulta((prev) => (prev ? { ...prev, estado: 'procesando' } : null));
        setMostrarAgregarAudio(false);
        toast('Bloque agregado, actualizando la historia clínica...', 'success');
      } else {
        // Toast, no setError: esta pantalla ya cargo bien, un fallo al agregar un bloque
        // no debe reemplazar toda la vista de la consulta (setError dispara esa pantalla
        // de error a pagina completa mas abajo). agregarBloqueConsulta ya guardo el motivo
        // real en apiError (viene del backend, p. ej. "Solo se pueden agregar bloques a
        // una consulta en borrador."), asi que no lo pisamos con un mensaje generico.
        toast(apiError || 'No se pudo agregar el bloque de audio.', 'error');
      }
    } catch (err) {
      console.error(err);
      toast(getErrorMessage(err, 'Error al agregar el bloque de audio.'), 'error');
    } finally {
      setIsAgregandoBloque(false);
    }
  };

  const handleSubirExamen = async () => {
    if (!consultaId || !examenArchivo) return;
    setIsSubiendoExamen(true);
    try {
      const nombre = examenNombre.trim() || examenArchivo.name;
      const examen = await subirExamenConsulta(consultaId, nombre, examenArchivo);
      setConsulta((prev) =>
        prev ? { ...prev, examenes: [...(prev.examenes ?? []), examen] } : null
      );
      setExamenNombre('');
      setExamenArchivo(null);
      setMostrarSubirExamen(false);
      toast('Resultado de examen agregado a la historia.', 'success');
    } catch (err) {
      console.error(err);
      toast(getErrorMessage(err, 'Error al subir el resultado del examen.'), 'error');
    } finally {
      setIsSubiendoExamen(false);
    }
  };

  // Consulta rapida (Opcion B): mientras la consulta tenga pacientePendienteConfirmar,
  // buscamos si el nombre detectado por la IA coincide con un paciente ya registrado.
  const pacienteCoincidente = useMemo(() => {
    if (!consulta?.pacientePendienteConfirmar || !consulta.datosDetectados) return null;
    return buscarPacienteCoincidente(consulta.datosDetectados, todosPacientes, paciente?.id);
  }, [consulta, todosPacientes, paciente]);

  const handleVincularPacienteDetectado = async () => {
    if (!consultaId || !pacienteCoincidente?.id) return;
    setIsVinculandoPaciente(true);
    try {
      const ok = await vincularConsulta(pacienteCoincidente.id, consultaId);
      if (!ok) throw new Error('No se pudo vincular la consulta al paciente.');
      toast('Consulta vinculada al paciente existente.', 'success');
      navigate(`/pacientes/${pacienteCoincidente.id}/consultas/${consultaId}`, { replace: true });
    } catch (err) {
      console.error(err);
      toast(getErrorMessage(err, 'Error al vincular la consulta con el paciente.'), 'error');
    } finally {
      setIsVinculandoPaciente(false);
    }
  };

  const handleConfirmarPacienteNuevo = async (datos: DatosPacienteNuevo) => {
    if (!paciente?.id || !consultaId) return;
    setIsConfirmandoPacienteNuevo(true);
    try {
      const telefono = joinPhone(datos.telefonoPais, datos.telefonoNumero);
      const camposPaciente: Partial<Paciente> = {
        esPlaceholder: false,
        nombre: datos.nombre.trim(),
        especie: datos.especie,
        raza: datos.raza.trim() || undefined,
        color: datos.color.trim() || undefined,
        chip: datos.chip.trim() || undefined,
        sexo: datos.sexo,
        estadoReproductivo: datos.estadoReproductivo,
        fechaNacimiento: datos.fechaNacimiento || undefined,
        notasGenerales: datos.notasGenerales.trim() || undefined,
        propietario: {
          ...paciente.propietario,
          ...(datos.nombrePropietario.trim() ? { nombre: datos.nombrePropietario.trim() } : {}),
          ...(telefono ? { telefono } : {}),
          ...(datos.emailPropietario.trim() ? { email: datos.emailPropietario.trim() } : {}),
        },
      };
      const okPaciente = await actualizarPaciente(paciente.id, camposPaciente);
      if (!okPaciente) throw new Error('No se pudo actualizar el paciente.');

      const okConsulta = await actualizarConsulta(consultaId, { pacientePendienteConfirmar: false });
      if (!okConsulta) throw new Error('No se pudo actualizar la consulta.');

      setConsulta((prev) => (prev ? { ...prev, pacientePendienteConfirmar: false } : null));
      setPaciente((prev) => (prev ? { ...prev, ...camposPaciente } : null));
      toast('Datos del paciente confirmados.', 'success');
    } catch (err) {
      console.error(err);
      toast(getErrorMessage(err, 'Error al confirmar los datos del paciente.'), 'error');
    } finally {
      setIsConfirmandoPacienteNuevo(false);
    }
  };

  const handleSaveDiagnosticos = async (diagnosticoEstructurado: DiagnosticoEstructurado[]) => {
    if (!consultaId) return;
    try {
      const ok = await actualizarConsulta(consultaId, { diagnosticoEstructurado });
      if (ok) setConsulta((prev) => (prev ? { ...prev, diagnosticoEstructurado } : null));
      else throw new Error('No se pudo guardar el diagnostico estructurado.');
    } catch (err) {
      console.error(err);
      toast(getErrorMessage(err, 'Error al actualizar el diagnostico estructurado.'), 'error');
    }
  };

  const handleApprove = async () => {
    if (!consultaId) return;
    setIsApproving(true);
    try {
      const ok = await aprobarConsulta(consultaId);
      if (ok) setConsulta((prev) => (prev ? { ...prev, estado: 'aprobada' } : null));
      else throw new Error('No se pudo cambiar el estado de la consulta.');
    } catch (err) {
      console.error(err);
      toast(getErrorMessage(err, 'Error al aprobar la consulta.'), 'error');
    } finally {
      setIsApproving(false);
    }
  };

  const handleSaveDatos = async () => {
    if (!consultaId) return;
    setIsSavingDatos(true);
    try {
      const cleanSv: Record<string, unknown> = {};
      Object.entries(editData.signosVitales).forEach(([k, v]) => {
        if (v !== undefined && v !== '' && v !== null) cleanSv[k] = v;
      });
      const updates: Partial<Consulta> = {
        motivo: editData.motivo.trim(),
        prioridad: editData.prioridad,
        signosVitales: cleanSv as Consulta['signosVitales'],
      };
      if (consulta?.soap) updates.soap = consulta.soap;
      const ok = await actualizarConsulta(consultaId, updates);
      if (ok) setConsulta((prev) => (prev ? { ...prev, ...updates } : null));
      else throw new Error('No se pudo guardar los datos.');
    } catch (err) {
      console.error(err);
      toast(getErrorMessage(err, 'Error al guardar los datos clínicos.'), 'error');
    } finally {
      setIsSavingDatos(false);
    }
  };

  const handleDelete = async () => {
    if (!consultaId || !pacienteId) return;
    const okConfirm = await confirm({
      title: 'Eliminar consulta',
      message: '¿Estás seguro de eliminar esta consulta? Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    });
    if (!okConfirm) return;
    setIsDeleting(true);
    try {
      const ok = await eliminarConsulta(consultaId);
      if (ok) navigate(`/pacientes/${pacienteId}`);
      else throw new Error('No se pudo eliminar la consulta.');
    } catch (err) {
      console.error(err);
      toast(getErrorMessage(err, 'Error al eliminar la consulta.'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddMedToPlan = async (med: MedicamentoSugerido) => {
    if (!consulta || !consulta.soap) return;
    const currentPlan = consulta.soap.plan || '';
    const medLine = `• ${med.nombre} | ${med.dosis} | ${med.via} | ${med.frecuencia} | ${med.duracion}`;
    const newPlan = currentPlan ? `${currentPlan}\n${medLine}` : medLine;
    const ok = await handleSaveSoap({ ...consulta.soap, plan: newPlan });
    if (ok) toast(`${med.nombre} agregado al Plan.`, 'success');
  };

  // Datos del vet para el PDF: perfil de la clinica con fallback al user logueado.
  const datosVet = (): DatosVetPDF => ({
    veterinaria: perfilVet?.veterinaria,
    sede: perfilVet?.sede,
    ciudad: perfilVet?.ciudad,
    telefono: perfilVet?.telefono,
    whatsapp: perfilVet?.whatsapp,
    nombre: perfilVet?.nombre || user?.nombre,
    matriculaProfesional: perfilVet?.matriculaProfesional || user?.matriculaProfesional,
  });

  const buildPdfInput = (): HistoriaClinicaPDFInput | null => {
    if (!consulta || !paciente || !user) return null;
    return { consulta, paciente, vet: datosVet() };
  };

  const handleSendWhatsApp = async () => {
    if (!paciente?.propietario?.whatsapp && !paciente?.propietario?.telefono) {
      toast('El propietario no tiene número de teléfono registrado. Actualiza sus datos.', 'warn');
      return;
    }
    setIsSendingWhatsApp(true);
    try {
      const input = buildPdfInput();
      if (!input) throw new Error('No se pudo generar el PDF');
      const urlPdf = await obtenerUrlPDF(consultaId!, () =>
        renderHistoriaClinicaPDF(input).output('blob')
      );
      window.open(construirUrlWhatsApp({ paciente, consulta: consulta!, urlPdf }), '_blank');
      toast('WhatsApp abierto con enlace al PDF.', 'success');
    } catch (err) {
      console.error(err);
      toast('Error al generar o subir el PDF.', 'error');
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleSendEmail = async () => {
    if (!paciente?.propietario?.email) {
      toast('El propietario no tiene correo electrónico registrado.', 'warn');
      return;
    }

    if (!getFeatureFlags().emailRealEnabled) {
      toast(
        'Envío de correo real pendiente de activación. En demo usa PDF o WhatsApp para compartir la historia clínica.',
        'info',
      );
      return;
    }

    setIsSendingEmail(true);
    try {
      // El envio de correo siempre pasa por la API: el PDF se resuelve server-side,
      // no hace falta generarlo/subirlo desde el navegador antes de enviar.
      await enviarHistorialEmail(consultaId!, {
        emailDestinatario: paciente.propietario.email,
        nombrePropietario: paciente.propietario.nombre,
        nombrePaciente: paciente.nombre,
        nombreVet: user?.nombre || 'Veterinario',
      });
      toast('Correo enviado exitosamente.', 'success');
    } catch (err) {
      console.error(err);
      toast(getErrorMessage(err, 'Error al enviar el correo.'), 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleDownloadPDF = async () => {
    const input = buildPdfInput();
    if (!input || !consultaId) return;
    const filename = `HC_${consulta?.numeroHC || 'SF'}_${paciente?.nombre.replace(/\s/g, '_')}.pdf`;

    try {
      if (getFeatureFlags().useApiDocs) {
        // POST genera/sube el PDF; GET /pdf/download evita fetch cross-origin a GCS (CORS).
        await obtenerUrlPDF(consultaId, () => renderHistoriaClinicaPDF(input).output('blob'));
        const res = await apiClient.get(`/v1/consultas/${consultaId}/pdf/download`, {
          responseType: 'blob',
        });
        const blob = res.data as Blob;
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
        return;
      }
      const pdf = renderHistoriaClinicaPDF(input);
      pdf.save(filename);
    } catch (err) {
      console.error(err);
      toast(getErrorMessage(err, 'Error al generar el PDF.'), 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto"></div>
          <p className="text-sm font-semibold text-slate-500 animate-pulse">Cargando consulta...</p>
        </div>
      </div>
    );
  }

  if (error || !consulta || !paciente) {
    return (
      <div className="max-w-md mx-auto text-center py-12 bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800 mb-2">Error al cargar</h3>
        <p className="text-sm text-slate-500 mb-6">
          {error || apiError || 'No se encontró el registro clínico.'}
        </p>
        <Link to="/pacientes" className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-bold">
          Volver a Pacientes
        </Link>
      </div>
    );
  }

  // Aviso visible solo cuando el borrador requiere revision manual; en aprobadas con SOAP no se muestra fallo de IA.
  const iaFallida = consulta.estado !== 'aprobada' && consulta.soap?.generadoPorIA === false;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="command-hero p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Link
              to={`/pacientes/${paciente.id}`}
              className="shrink-0 rounded-xl border border-white/15 bg-white/12 p-2 text-white/75 transition-colors hover:bg-white hover:text-[var(--accent-strong)]"
              title="Volver al expediente"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h1 className="text-sm font-black tracking-tight text-white sm:text-base">
                  Historia Clínica{' '}
                  {consulta.numeroHC && (
                    <span className="text-emerald-100">#{consulta.numeroHC}</span>
                  )}
                </h1>
                {consulta.prioridad && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${PRIORIDAD_COLORS[consulta.prioridad]}`}
                  >
                    {PRIORIDAD_LABELS[consulta.prioridad]}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    consulta.estado === 'aprobada'
                      ? 'bg-white/18 text-emerald-100 ring-1 ring-emerald-200/20'
                      : consulta.estado === 'procesando'
                        ? 'bg-amber-200/18 text-amber-100 ring-1 ring-amber-200/20'
                        : 'bg-white/14 text-white/72 ring-1 ring-white/15'
                  }`}
                >
                  {consulta.estado === 'aprobada' ? 'Aprobada' : consulta.estado}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-white/72 sm:text-xs">
                Paciente:{' '}
                <Link to={`/pacientes/${paciente.id}`} className="font-bold text-white hover:underline">
                  {paciente.nombre}
                </Link>{' '}
                · {new Date(consulta.fechaHora).toLocaleString('es-CO')}
              </p>
            </div>
          </div>

          <ConsultaActions
          data-tour="consulta-acciones"
          consulta={consulta}
          paciente={paciente}
          isDeleting={isDeleting}
          isSavingDatos={isSavingDatos}
          isApproving={isApproving}
          isSendingWhatsApp={isSendingWhatsApp}
          isSendingEmail={isSendingEmail}
          onDelete={handleDelete}
          onSaveDatos={handleSaveDatos}
          onApprove={handleApprove}
          onSendWhatsApp={handleSendWhatsApp}
          onSendEmail={handleSendEmail}
          onDownloadPDF={handleDownloadPDF}
        />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ColumnaIzquierda
          consulta={consulta}
          editData={editData}
          onChangeEditData={setEditData}
        />

        <div className="lg:col-span-2 space-y-5">
          {consulta.estado === 'procesando' ? (
            <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-12 text-center shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent mx-auto"></div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Procesando nota SOAP</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  La Inteligencia Artificial está analizando la transcripción clínica.
                </p>
              </div>
            </div>
          ) : (
            <>
              {consulta.pacientePendienteConfirmar && consulta.datosDetectados && (
                <PacienteDetectadoBanner
                  datosDetectados={consulta.datosDetectados}
                  pacienteCoincidente={pacienteCoincidente}
                  isVinculando={isVinculandoPaciente}
                  isConfirmando={isConfirmandoPacienteNuevo}
                  onVincular={handleVincularPacienteDetectado}
                  onConfirmarNuevo={handleConfirmarPacienteNuevo}
                />
              )}
              {iaFallida && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <span className="font-bold">Revision clinica requerida:</span> valida la nota antes de compartirla.
                    Puedes ajustar la estructura SOAP manualmente y aprobar cuando el contenido este listo.
                  </div>
                </div>
              )}
              {consulta.estado === 'borrador' && (
                <div
                  className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]"
                  data-tour="consulta-agregar-audio"
                >
                  {mostrarAgregarAudio ? (
                    <AudioRecorder
                      onAudioRecorded={handleAgregarBloque}
                      isProcessing={isAgregandoBloque}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMostrarAgregarAudio(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-bold text-slate-600 transition hover:border-accent hover:text-accent"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Agregar más audio a esta consulta
                    </button>
                  )}
                </div>
              )}

              <SoapViewer
                data-tour="consulta-soap"
                soap={consulta.soap}
                onSave={consulta.estado === 'borrador' ? handleSaveSoap : undefined}
              />
              <DiagnosticoEstructuradoPanel
                value={consulta.diagnosticoEstructurado}
                analisisTexto={consulta.soap?.analisis ?? ''}
                editable={consulta.estado === 'borrador'}
                onChange={consulta.estado === 'borrador' ? handleSaveDiagnosticos : undefined}
              />
              <PanelMedicamentos consulta={consulta} onAddMedToPlan={handleAddMedToPlan} />

              <div
                className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)] space-y-2.5"
                data-tour="consulta-examenes"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-slate-800">Exámenes complementarios</h3>
                  {!mostrarSubirExamen && (
                    <button
                      type="button"
                      onClick={() => setMostrarSubirExamen(true)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-500 transition hover:border-accent hover:text-accent"
                    >
                      <Upload className="h-3 w-3" />
                      Agregar
                    </button>
                  )}
                </div>

                {consulta.examenes?.length ? (
                  <ul className="space-y-2">
                    {consulta.examenes.map((ex) => (
                      <li key={ex.id} className="rounded-lg border border-slate-100 p-3 text-xs">
                        <p className="font-bold text-slate-700">{ex.nombre}</p>
                        <p className="mt-1 text-slate-500">{ex.resumen}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  !mostrarSubirExamen && <p className="text-xs text-slate-400">Sin exámenes subidos todavía.</p>
                )}

                {mostrarSubirExamen && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={examenNombre}
                      onChange={(e) => setExamenNombre(e.target.value)}
                      placeholder="Nombre del examen (opcional)"
                      className="min-h-9 flex-1 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-accent"
                    />
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setExamenArchivo(e.target.files?.[0] ?? null)}
                      className="text-xs"
                    />
                    <button
                      type="button"
                      disabled={!examenArchivo || isSubiendoExamen}
                      onClick={handleSubirExamen}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white transition hover:bg-accent-strong disabled:opacity-50"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {isSubiendoExamen ? 'Subiendo...' : 'Subir resultado'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetalleConsulta;
export { DetalleConsulta };
