import React, { useMemo, useState } from 'react';
import { useTourGuide } from '../hooks/useTourGuide';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Filter, ListChecks, Syringe, ShieldAlert } from 'lucide-react';
import { usePacientes } from '../hooks/usePacientes';
import { Card, Button, Badge, Skeleton, EmptyState, KpiCard, SectionHeader, PageHeader } from '../components/ui/Primitives';
import {
  listarVacunas,
  marcarVacunaAplicada,
  etiquetaEstadoVacuna,
  toDateInput,
  type EstadoVacuna,
  type Vacuna,
} from '../features/vacunas/api';
import type { Paciente } from '../types';

const inputClasses =
  'w-full min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none transition-all placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]';

const ESTADOS: Array<{ value: EstadoVacuna | ''; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'proxima_a_vencer', label: 'Próximas' },
  { value: 'vencida', label: 'Vencidas' },
  { value: 'al_dia', label: 'Al día' },
];

const ESPECIES: Array<Paciente['especie'] | ''> = ['', 'perro', 'gato', 'ave', 'reptil', 'otro'];

const fechaCorta = (iso?: string): string => {
  if (!iso) return 'Sin fecha';
  const input = toDateInput(iso);
  return input || iso;
};

const TOUR_STEPS_VACUNAS = [
  { element: '[data-tour="vacunas-control"]', popover: { title: 'Control de vacunas', description: 'Aquí controlas el carnet de vacunación de cada paciente: qué se aplicó, cuándo, y qué dosis vienen pronto. Filtra por estado, especie o paciente, y marca una vacuna como aplicada en un clic.' } },
  // TODO: El catálogo de vacunas no está expuesto directamente en esta vista de veterinario.
  // { element: '[data-tour="vacunas-catalogo"]', popover: { title: 'Catálogo de vacunas', description: 'Este catálogo te permite registrar rápido las vacunas que aplica tu veterinaria.' } }
];

const Vacunas: React.FC = () => {
  const qc = useQueryClient();
  const location = useLocation();
  const { pacientes } = usePacientes();
  const [pacienteId, setPacienteId] = useState('');
  const [especie, setEspecie] = useState('');
  const [estado, setEstado] = useState<EstadoVacuna | ''>('proxima_a_vencer');
  const [tipo, setTipo] = useState('');

  const currentTab = new URLSearchParams(location.search).get('tab') || 'control';
  useTourGuide('vacunas', TOUR_STEPS_VACUNAS);

  const filtros = useMemo(
    () => ({
      pacienteId: pacienteId || undefined,
      especie: especie || undefined,
      estado: estado || undefined,
      tipo: tipo || undefined,
    }),
    [estado, especie, pacienteId, tipo],
  );

  const vacunas = useQuery({
    queryKey: ['vacunas-listado', filtros],
    queryFn: () => listarVacunas(filtros),
  });

  const aplicar = useMutation({
    mutationFn: (v: Vacuna) => marcarVacunaAplicada(v.pacienteId, v.id),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['vacunas-listado'] });
      qc.invalidateQueries({ queryKey: ['vacunas', v.pacienteId] });
    },
  });

  const pacienteNombre = (id: string): string =>
    pacientes.find((p) => p.id === id)?.nombre ?? 'Paciente';

  const lista = vacunas.data ?? [];
  const proximas = lista.filter((v) => v.estado === 'proxima_a_vencer').length;
  const vencidas = lista.filter((v) => v.estado === 'vencida').length;
  const alDia = lista.filter((v) => v.estado === 'al_dia').length;

  const total = lista.length;
  const coveragePct = total ? Math.round((alDia / total) * 100) : 100;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 animate-fade-in py-4">
      <PageHeader
        badge="Prevención clínica"
        title="Vacunación"
        description="Seguimiento de próximas dosis, vencimientos y aplicaciones por paciente."
        action={
          <Link
            to="/pacientes"
            className="inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all shrink-0"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Pacientes
          </Link>
        }
      />

      {currentTab === 'metricas' ? (
        /* Real Metrics Dashboard view */
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              label="Vacunas Registradas"
              value={total}
              hint="Historial de planes de vacunación"
              icon={<Syringe className="h-5 w-5" />}
              accent="info"
            />
            <KpiCard
              label="Cobertura Al Día"
              value={`${coveragePct}%`}
              hint={`${alDia} de ${total} vacunas vigentes`}
              icon={<CheckCircle2 className="h-5 w-5" />}
              accent="success"
            />
            <KpiCard
              label="Vacunas Críticas (Vencidas)"
              value={vencidas}
              hint="Requieren aplicación inmediata"
              icon={<ShieldAlert className="h-5 w-5" />}
              accent="danger"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card padding="lg">
              <SectionHeader
                title="Distribución de Estados de Vacunas"
                description="Consolidado actual de inmunización preventiva."
              />
              <div className="mt-6 space-y-4">
                {[
                  { label: 'Al día', count: alDia, color: 'bg-emerald-500' },
                  { label: 'Próximas a vencer', count: proximas, color: 'bg-amber-500' },
                  { label: 'Vencidas', count: vencidas, color: 'bg-red-500' },
                ].map((item) => {
                  const pct = total ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.label} className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span>{item.label}</span>
                        <span>{item.count} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card padding="lg">
              <SectionHeader
                title="Monitoreo Preventivo"
                description="Eficiencia y cumplimiento de vacunación."
              />
              <div className="mt-6 space-y-6">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Importancia Preventiva</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Las vacunas son esenciales para la salud pública y la prevención de epidemias animales. Mantener una cobertura superior al 85% asegura protección colectiva en la comunidad clínica.
                  </p>
                </div>
                <div className="flex items-center justify-between p-4 bg-accent/5 border border-accent/10 rounded-2xl">
                  <div>
                    <h5 className="text-xs font-extrabold text-accent uppercase tracking-wider">Vacunación Completa</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">Indicador de salud del hato/sede</p>
                  </div>
                  <span className="text-lg font-black text-accent bg-white px-3 py-1 rounded-xl shadow-sm border border-accent/10">100%</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* Default Control list view */
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              label="Próximas a vencer"
              value={proximas}
              hint="Seguimiento preventivo"
              icon={<Syringe className="h-5 w-5" />}
              accent="warn"
            />
            <KpiCard
              label="Vencidas"
              value={vencidas}
              hint="Requieren revisión"
              icon={<AlertTriangle className="h-5 w-5" />}
              accent="danger"
            />
            <KpiCard
              label="Resultados filtrados"
              value={lista.length}
              hint={`${pacientes.length} pacientes disponibles`}
              icon={<ListChecks className="h-5 w-5" />}
              accent="info"
            />
          </div>

          <Card padding="lg" data-tour="vacunas-control">
            <SectionHeader
              title="Control de vacunas"
              description="Filtra por estado, especie, paciente o tipo para priorizar la atención preventiva."
              action={<Filter className="h-5 w-5 text-accent" />}
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[150px_150px_minmax(180px,1fr)_minmax(180px,1fr)_auto]">
              <label className="grid gap-1.5 text-xs font-bold text-slate-500">
                Estado
                <select
                  aria-label="Filtrar por estado"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoVacuna | '')}
                  className={inputClasses}
                >
                  {ESTADOS.map((item) => (
                    <option key={item.value || 'todos'} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-500">
                Especie
                <select
                  aria-label="Filtrar por especie"
                  value={especie}
                  onChange={(e) => setEspecie(e.target.value)}
                  className={inputClasses}
                >
                  {ESPECIES.map((item) => (
                    <option key={item || 'todas'} value={item}>
                      {item || 'Todas'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-500">
                Paciente
                <select
                  aria-label="Filtrar por paciente"
                  value={pacienteId}
                  onChange={(e) => setPacienteId(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">Todos</option>
                  {pacientes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-500">
                Tipo
                <input
                  aria-label="Filtrar por tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  placeholder="Rabia o código"
                  className={inputClasses}
                />
              </label>

              <Button
                variant="ghost"
                onClick={() => {
                  setPacienteId('');
                  setEspecie('');
                  setEstado('');
                  setTipo('');
                }}
              >
                Limpiar
              </Button>
            </div>

            {vacunas.isLoading ? (
              <div className="mt-5 grid gap-3">
                <Skeleton height={72} />
                <Skeleton height={72} />
              </div>
            ) : lista.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  titulo="Sin vacunas para los filtros"
                  mensaje="Ajusta el filtro o vuelve a todos los estados para revisar el calendario preventivo completo."
                  icon={<Syringe className="h-5 w-5" />}
                />
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {lista.map((v) => (
                  <div
                    key={v.id}
                    className="grid gap-4 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-[0_16px_42px_-36px_rgba(15,23,42,0.55)] transition-all hover:border-accent/30 hover:bg-white lg:grid-cols-[minmax(180px,1fr)_auto]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-base text-slate-950">{v.nombre}</strong>
                        <Badge estado={v.estado}>{etiquetaEstadoVacuna(v.estado)}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                        <Link to={`/pacientes/${v.pacienteId}`} className="font-black text-accent hover:underline">
                          {pacienteNombre(v.pacienteId)}
                        </Link>
                        <span className="text-slate-300">/</span>
                        <span>{v.especie ?? 'especie n/d'}</span>
                        <span className="text-slate-300">/</span>
                        <span>Próxima: {fechaCorta(v.proximaDosis)}</span>
                        {v.aplicada && (
                          <>
                            <span className="text-slate-300">/</span>
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Aplicada: {fechaCorta(v.aplicada)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      disabled={aplicar.isPending}
                      onClick={() => aplicar.mutate(v)}
                    >
                      Marcar aplicada
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default Vacunas;
export { Vacunas };
