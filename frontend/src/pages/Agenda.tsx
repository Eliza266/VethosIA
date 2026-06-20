import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, CalendarDays, CheckCircle2, Clock3, Link2, Plus, Users } from 'lucide-react';
import { useCitas } from '../features/citas/hooks';
import { citasEnVista, agruparPorDia, type VistaAgenda } from '../features/citas/agenda';
import {
  etiquetaPacienteCita,
  motivoCita,
  sugerirPacientePorTitulo,
  type Cita,
} from '../features/citas/api';
import { usePacientes } from '../hooks/usePacientes';
import { Card, Button, Badge, Skeleton, EmptyState, KpiCard, PageHeader, SectionHeader } from '../components/ui/Primitives';

const ESTADO_LABEL: Record<Cita['estado'], string> = {
  programada: 'Programada',
  en_atencion: 'En atención',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
};

const inputClasses =
  'min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/12';

// Agenda: citas vinculadas a paciente y consulta clínica vía /v1/citas.
const Agenda: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, crear, cambiarEstado, vincularPaciente } = useCitas();
  const { pacientes } = usePacientes();
  const [vista, setVista] = useState<VistaAgenda>('semana');
  const [pacienteId, setPacienteId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [fecha, setFecha] = useState('');
  const [vinculoManual, setVinculoManual] = useState<Record<string, string>>({});

  const referencia = useMemo(() => new Date(), []);
  const visibles = useMemo(() => citasEnVista(data ?? [], vista, referencia), [data, vista, referencia]);
  const porDia = useMemo(() => agruparPorDia(visibles), [visibles]);
  const citasProgramadas = visibles.filter((c) => c.estado === 'programada').length;
  const citasVinculadas = visibles.filter((c) => Boolean(c.pacienteId)).length;
  const citasAtendidas = visibles.filter((c) => c.estado === 'realizada' || Boolean(c.consultaId)).length;

  const atender = async (cita: Cita) => {
    if (!cita.pacienteId) return;
    await cambiarEstado.mutateAsync({ id: cita.id, estado: 'en_atencion' });
    navigate(`/pacientes/${cita.pacienteId}/consultas/nueva?citaId=${cita.id}`);
  };

  const renderAcciones = (c: Cita) => {
    if (c.consultaId && c.pacienteId) {
      return (
        <Link to={`/pacientes/${c.pacienteId}/consultas/${c.consultaId}`}>
          <Button variant="ghost">Abrir consulta</Button>
        </Link>
      );
    }
    if (c.pacienteId && (c.estado === 'programada' || c.estado === 'en_atencion')) {
      return (
        <Button variant="primary" onClick={() => void atender(c)}>
          Atender / Crear consulta
        </Button>
      );
    }
    if (!c.pacienteId) {
      const sugerido = sugerirPacientePorTitulo(c.titulo, pacientes);
      const seleccion = vinculoManual[c.id] ?? sugerido?.id ?? '';
      return (
        <span className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
            <Link2 className="h-3.5 w-3.5" />
            Paciente no vinculado
          </span>
          <select
            aria-label="Vincular paciente"
            value={seleccion}
            onChange={(e) => setVinculoManual((m) => ({ ...m, [c.id]: e.target.value }))}
            className={inputClasses}
          >
            <option value="">Seleccionar paciente…</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {sugerido?.id === p.id ? ' (sugerido)' : ''}
              </option>
            ))}
          </select>
          {seleccion && (
            <Button
              variant="ghost"
              disabled={vincularPaciente.isPending}
              onClick={() => vincularPaciente.mutate({ id: c.id, pacienteId: seleccion })}
            >
              Vincular
            </Button>
          )}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6 animate-fade-in py-4">
      <PageHeader
        badge="Operación clínica"
        title="Agenda"
        description="Planifica citas, vincula pacientes y abre la consulta clínica desde una vista segura por rol."
        action={
          <div
            role="tablist"
            aria-label="Vista de agenda"
            className="inline-flex rounded-2xl border border-slate-200 bg-white/80 p-1 shadow-sm"
          >
            {(['dia', 'semana', 'mes'] as VistaAgenda[]).map((v) => (
              <Button
                key={v}
                variant={v === vista ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setVista(v)}
                className="min-w-20"
                style={v === vista ? undefined : { border: 'none', boxShadow: 'none' }}
              >
                {v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label="Citas visibles"
          value={visibles.length}
          hint={`${citasProgramadas} programadas`}
          icon={<CalendarDays className="h-5 w-5" />}
          accent="info"
        />
        <KpiCard
          label="Pacientes vinculados"
          value={`${citasVinculadas}/${visibles.length || 0}`}
          hint="Listas para abrir consulta"
          icon={<Users className="h-5 w-5" />}
          accent="success"
        />
        <KpiCard
          label="Atención cerrada"
          value={citasAtendidas}
          hint="Consulta creada o realizada"
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="warn"
        />
      </div>

      <Card padding="lg">
        <SectionHeader
          title="Nueva cita"
          description="Registra una atención programada sin salir del flujo clínico."
          action={<Plus className="h-5 w-5 text-[var(--accent)]" />}
        />
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(180px,1.1fr)_minmax(180px,1fr)_minmax(180px,0.9fr)_auto]">
          <select
            aria-label="Paciente"
            value={pacienteId}
            onChange={(e) => setPacienteId(e.target.value)}
            className={inputClasses}
          >
            <option value="">Seleccionar paciente…</option>
            {pacientes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <input
            aria-label="Motivo de la cita"
            placeholder="Motivo (ej. control, vacuna)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className={inputClasses}
          />
          <input
            aria-label="Fecha y hora"
            type="datetime-local"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={inputClasses}
          />
          <Button
            disabled={!pacienteId || !motivo || !fecha || crear.isPending}
            className="min-h-11"
            onClick={() => {
              crear.mutate({ pacienteId, motivo, fecha: new Date(fecha).toISOString() });
              setMotivo('');
              setFecha('');
              setPacienteId('');
            }}
          >
            Agendar
          </Button>
        </div>
      </Card>

      <Card padding="lg">
        <SectionHeader
          title="Calendario operativo"
          description="Citas agrupadas por día, estado y siguiente acción clínica."
        />
        <div className="mt-5">
          {isLoading && (
            <div className="grid gap-3">
              <Skeleton height={78} />
              <Skeleton height={78} />
            </div>
          )}
          {!isLoading && visibles.length === 0 && (
            <EmptyState
              titulo="Sin citas en esta vista"
              mensaje="Crea una cita o cambia de día, semana o mes para revisar otra ventana operativa."
              icon={<CalendarClock className="h-5 w-5" />}
            />
          )}

          {!isLoading &&
            Object.entries(porDia).map(([dia, citas]) => (
              <section key={dia} className="mb-5 last:mb-0">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="veth-section-label">Día de atención</p>
                    <h2 className="text-lg font-black text-slate-950">{dia}</h2>
                  </div>
                  <Badge estado="info">{citas.length} citas</Badge>
                </div>
                <ul className="grid gap-3">
                  {citas.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-[0_16px_42px_-36px_rgba(15,23,42,0.55)] transition-all hover:border-[#0F6E56]/30 hover:bg-white"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-sm font-black text-slate-950">
                              <Clock3 className="h-4 w-4 text-[var(--accent)]" />
                              {new Date(c.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-slate-300">/</span>
                            <span className="font-bold text-slate-900">{etiquetaPacienteCita(c)}</span>
                          </div>
                          <div className="mt-1 text-sm text-slate-500">{motivoCita(c)}</div>
                          {c.historiaClinicaId && (
                            <div className="mt-1 text-xs font-semibold text-slate-400">HC: {c.historiaClinicaId}</div>
                          )}
                        </div>
                        <Badge estado={c.estado}>{ESTADO_LABEL[c.estado] ?? c.estado}</Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {renderAcciones(c)}
                        {c.estado === 'programada' && c.pacienteId && (
                          <>
                            <Button variant="ghost" onClick={() => cambiarEstado.mutate({ id: c.id, estado: 'cancelada' })}>
                              Cancelar
                            </Button>
                            <Button variant="ghost" onClick={() => cambiarEstado.mutate({ id: c.id, estado: 'no_asistio' })}>
                              No asistió
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </Card>
    </div>
  );
};

export default Agenda;
export { Agenda };
