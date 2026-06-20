import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Filter, ListChecks, Syringe } from 'lucide-react';
import { usePacientes } from '../hooks/usePacientes';
import { Card, Button, Badge, Skeleton, EmptyState, KpiCard, PageHeader, SectionHeader } from '../components/ui/Primitives';
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
  'min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/12';

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

const Vacunas: React.FC = () => {
  const qc = useQueryClient();
  const { pacientes } = usePacientes();
  const [pacienteId, setPacienteId] = useState('');
  const [especie, setEspecie] = useState('');
  const [estado, setEstado] = useState<EstadoVacuna | ''>('proxima_a_vencer');
  const [tipo, setTipo] = useState('');

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

  return (
    <div className="mx-auto grid max-w-6xl gap-6 animate-fade-in py-4">
      <PageHeader
        badge="Prevención clínica"
        title="Vacunas"
        description="Seguimiento de próximas dosis, vencimientos y aplicaciones por paciente dentro del scope autorizado."
        action={
          <Link
            to="/pacientes"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Pacientes
          </Link>
        }
      />

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

      <Card padding="lg">
        <SectionHeader
          title="Control de vacunas"
          description="Filtra por estado, especie, paciente o tipo para priorizar la atención preventiva."
          action={<Filter className="h-5 w-5 text-[var(--accent)]" />}
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
                className="grid gap-4 rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-[0_16px_42px_-36px_rgba(15,23,42,0.55)] transition-all hover:border-[#0F6E56]/30 hover:bg-white lg:grid-cols-[minmax(180px,1fr)_auto]"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-base text-slate-950">{v.nombre}</strong>
                    <Badge estado={v.estado}>{etiquetaEstadoVacuna(v.estado)}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                    <Link to={`/pacientes/${v.pacienteId}`} className="font-black text-[var(--accent)] hover:underline">
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
    </div>
  );
};

export default Vacunas;
export { Vacunas };
