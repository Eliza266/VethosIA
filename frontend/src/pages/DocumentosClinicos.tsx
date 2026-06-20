import React, { useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Mail, MessageCircle } from 'lucide-react';
import { useConsultas } from '../hooks/useConsultas';
import { usePacientes } from '../hooks/usePacientes';
import {
  findLatestApprovedConsulta,
  type ClinicalDocumentAction,
} from '../lib/clinicalDocuments';
import { formatClinicalDateTime, formatClinicalName } from '../lib/clinicalLabels';
import { EmptyState, PageHeader } from '../components/ui/Primitives';
import RouteLoadingSpinner from '../components/RouteLoadingSpinner';

const ACTION_COPY: Record<
  ClinicalDocumentAction,
  { title: string; description: string; icon: React.ReactNode }
> = {
  pdf: {
    title: 'PDF clínico',
    description: 'Genera y revisa la historia clínica aprobada antes de compartirla.',
    icon: <FileText className="h-6 w-6" />,
  },
  email: {
    title: 'Email demo',
    description: 'Simula el envío controlado asociado a una consulta aprobada. No se activa correo real.',
    icon: <Mail className="h-6 w-6" />,
  },
  whatsapp: {
    title: 'WhatsApp seguro',
    description: 'Abre un enlace controlado al documento clínico. La API real de WhatsApp no se ejecuta.',
    icon: <MessageCircle className="h-6 w-6" />,
  },
};

function parseAction(raw: string | null): ClinicalDocumentAction {
  if (raw === 'email' || raw === 'whatsapp') return raw;
  return 'pdf';
}

const DocumentosClinicos: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const action = parseAction(params.get('accion'));
  const copy = ACTION_COPY[action];
  const { fetchTodasConsultas } = useConsultas();
  const { pacientes, loading: loadingPacientes } = usePacientes();
  const [consultas, setConsultas] = React.useState<Awaited<ReturnType<typeof fetchTodasConsultas>>>([]);
  const [loadingConsultas, setLoadingConsultas] = React.useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoadingConsultas(true);
      try {
        const list = await fetchTodasConsultas();
        if (!alive) return;
        setConsultas(list ?? []);
      } catch {
        if (!alive) return;
        setConsultas([]);
      } finally {
        if (alive) setLoadingConsultas(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [fetchTodasConsultas]);

  const aprobadas = useMemo(
    () =>
      (consultas ?? [])
        .filter((c) => c.estado === 'aprobada' || c.soap)
        .sort((a, b) => new Date(b.fechaHora).getTime() - new Date(a.fechaHora).getTime()),
    [consultas],
  );

  const latest = findLatestApprovedConsulta(consultas ?? []);

  useEffect(() => {
    if (loadingConsultas || !latest?.id || !latest.pacienteId) return;
    if (aprobadas.length === 1) {
      navigate(`/pacientes/${latest.pacienteId}/consultas/${latest.id}?documento=${action}`, {
        replace: true,
      });
    }
  }, [action, aprobadas.length, latest, loadingConsultas, navigate]);

  if (loadingPacientes || loadingConsultas) {
    return <RouteLoadingSpinner message="Preparando documentos clínicos..." />;
  }

  const getPatientName = (pacienteId: string) =>
    formatClinicalName(pacientes.find((p) => p.id === pacienteId)?.nombre, 'Paciente');

  return (
    <div className="space-y-6 animate-fade-in" data-testid="documentos-clinicos">
      <PageHeader
        badge="Documentos clínicos"
        title={copy.title}
        description={copy.description}
      />

      {aprobadas.length === 0 ? (
        <EmptyState
          variant="controlled"
          titulo="Selecciona una consulta aprobada"
          mensaje="Para generar o compartir documentos, primero aprueba el SOAP de una consulta. Desde aquí no se ejecutan envíos reales ni se crean datos clínicos."
          icon={copy.icon}
          accion={
            <Link
              to="/pacientes"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-black text-[var(--accent-contrast)]"
            >
              Ir a pacientes
            </Link>
          }
        />
      ) : (
        <section className="premium-card space-y-4 p-5">
          <p className="text-sm leading-6 text-slate-600">
            Elige la consulta aprobada con la que quieres trabajar. Cada acción abre el detalle clínico
            con controles seguros de PDF, email demo o WhatsApp.
          </p>
          <div className="divide-y divide-slate-100">
            {aprobadas.slice(0, 8).map((consulta) => (
              <Link
                key={consulta.id}
                to={`/pacientes/${consulta.pacienteId}/consultas/${consulta.id}?documento=${action}`}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">
                    {getPatientName(consulta.pacienteId)}
                  </p>
                  <p className="text-xs text-slate-500">{formatClinicalDateTime(consulta.fechaHora)}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700">
                  SOAP aprobado
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DocumentosClinicos;
export { DocumentosClinicos };
