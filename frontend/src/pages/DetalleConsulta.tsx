import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useConsultas } from '../hooks/useConsultas';
import { usePacientes } from '../hooks/usePacientes';
import { useAuth } from '../hooks/useAuth';
import type {
  Consulta,
  DiagnosticoEstructurado,
  Paciente,
  SOAP,
  Veterinario,
  MedicamentoSugerido,
} from '../types';
import SoapViewer from '../components/SoapViewer';
import { ArrowLeft, AlertCircle, AlertTriangle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getErrorMessage } from '../lib/errors';
import { getFeatureFlags } from '../lib/featureFlags';
import { obtenerMe } from '../features/tenant/api';
import { apiClient } from '../lib/apiClient';
import {
  renderHistoriaClinicaPDF,
  type DatosVetPDF,
  type HistoriaClinicaPDFInput,
} from '../features/consultas/pdf';
import { construirUrlWhatsApp } from '../features/consultas/sharing';
import { obtenerUrlPDF, enviarHistorialEmail } from '../features/consultas/api';
import {
  PRIORIDAD_COLORS,
  PRIORIDAD_LABELS,
  type EditDataConsulta,
} from '../features/consultas/types';
import ConsultaActions from '../features/consultas/components/ConsultaActions';
import ColumnaIzquierda from '../features/consultas/components/ColumnaIzquierda';
import PanelMedicamentos from '../features/consultas/components/PanelMedicamentos';
import DiagnosticoEstructuradoPanel from '../features/consultas/components/DiagnosticoEstructuradoPanel';
import { useToast, useConfirm } from '../components/ui/Primitives';

const DetalleConsulta: React.FC = () => {
  const { pacienteId, consultaId } = useParams<{ pacienteId: string; consultaId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { getPaciente } = usePacientes();
  const { getConsulta, actualizarConsulta, aprobarConsulta, eliminarConsulta, error: apiError } = useConsultas();
  const { toast } = useToast();
  const { confirm } = useConfirm();

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

  const handleSaveSoap = async (updatedSoap: SOAP) => {
    if (!consultaId) return;
    try {
      const ok = await actualizarConsulta(consultaId, { soap: updatedSoap });
      if (ok) setConsulta((prev) => (prev ? { ...prev, soap: updatedSoap } : null));
      else throw new Error('No se pudo guardar la nota en la base de datos.');
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, 'Error al actualizar la nota SOAP.'));
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
      setError(getErrorMessage(err, 'Error al actualizar el diagnostico estructurado.'));
    }
  };

  const handleApprove = async () => {
    if (!consultaId) return;
    setIsApproving(true);
    setError(null);
    try {
      const ok = await aprobarConsulta(consultaId);
      if (ok) setConsulta((prev) => (prev ? { ...prev, estado: 'aprobada' } : null));
      else throw new Error('No se pudo cambiar el estado de la consulta.');
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err, 'Error al aprobar la consulta.'));
    } finally {
      setIsApproving(false);
    }
  };

  const handleSaveDatos = async () => {
    if (!consultaId) return;
    setIsSavingDatos(true);
    setError(null);
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
      setError(getErrorMessage(err, 'Error al guardar los datos clínicos.'));
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
      setError(getErrorMessage(err, 'Error al eliminar la consulta.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddMedToPlan = async (med: MedicamentoSugerido) => {
    if (!consulta || !consulta.soap) return;
    const currentPlan = consulta.soap.plan || '';
    const medLine = `• ${med.nombre} | ${med.dosis} | ${med.via} | ${med.frecuencia} | ${med.duracion}`;
    const newPlan = currentPlan ? `${currentPlan}\n${medLine}` : medLine;
    await handleSaveSoap({ ...consulta.soap, plan: newPlan });
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
      const { useApiDocs } = getFeatureFlags();
      const emailPayload = {
        emailDestinatario: paciente.propietario.email,
        nombrePropietario: paciente.propietario.nombre,
        nombrePaciente: paciente.nombre,
        nombreVet: user?.nombre || 'Veterinario',
      };
      if (!useApiDocs) {
        const input = buildPdfInput();
        if (!input) throw new Error('No se pudo generar el PDF');
        const urlPdf = await obtenerUrlPDF(consultaId!, () =>
          renderHistoriaClinicaPDF(input).output('blob')
        );
        await enviarHistorialEmail(consultaId!, { ...emailPayload, pdfUrl: urlPdf });
      } else {
        await enviarHistorialEmail(consultaId!, emailPayload);
      }
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0F6E56] border-t-transparent mx-auto"></div>
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
        <Link to="/pacientes" className="px-4 py-2.5 rounded-xl bg-[#0F6E56] text-white text-sm font-bold">
          Volver a Pacientes
        </Link>
      </div>
    );
  }

  // Aviso visible solo cuando el borrador requiere revision manual; en aprobadas con SOAP no se muestra fallo de IA.
  const iaFallida = consulta.estado !== 'aprobada' && consulta.soap?.generadoPorIA === false;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="command-hero p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <Link
              to={`/pacientes/${paciente.id}`}
              className="shrink-0 rounded-2xl border border-white/15 bg-white/12 p-2.5 text-white/75 transition-colors hover:bg-white hover:text-[var(--accent-strong)]"
              title="Volver al expediente"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-lg font-black tracking-tight text-white sm:text-xl">
                  Historia Clínica{' '}
                  {consulta.numeroHC && (
                    <span className="text-emerald-100">#{consulta.numeroHC}</span>
                  )}
                </h1>
                {consulta.prioridad && (
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${PRIORIDAD_COLORS[consulta.prioridad]}`}
                  >
                    {PRIORIDAD_LABELS[consulta.prioridad]}
                  </span>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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
              <p className="mt-1.5 text-xs text-white/72 sm:text-sm">
                Paciente:{' '}
                <Link to={`/pacientes/${paciente.id}`} className="font-bold text-white hover:underline">
                  {paciente.nombre}
                </Link>{' '}
                · {new Date(consulta.fechaHora).toLocaleString('es-CO')}
              </p>
            </div>
          </div>

          <ConsultaActions
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ColumnaIzquierda
          consulta={consulta}
          editData={editData}
          onChangeEditData={setEditData}
        />

        <div className="lg:col-span-2 space-y-6">
          {consulta.estado === 'procesando' ? (
            <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-12 text-center shadow-[0_14px_35px_-30px_rgba(15,23,42,0.45)]">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0F6E56] border-t-transparent mx-auto"></div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Procesando nota SOAP</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  La Inteligencia Artificial está analizando la transcripción clínica.
                </p>
              </div>
            </div>
          ) : (
            <>
              {iaFallida && (
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <span className="font-bold">Revision clinica requerida:</span> valida la nota antes de compartirla.
                    Puedes ajustar la estructura SOAP manualmente y aprobar cuando el contenido este listo.
                  </div>
                </div>
              )}
              <SoapViewer
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetalleConsulta;
export { DetalleConsulta };
