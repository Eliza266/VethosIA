import React, { useMemo, useState } from 'react';
import { useTourGuide } from '../hooks/useTourGuide';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Syringe } from 'lucide-react';
import { usePacientes } from '../hooks/usePacientes';
import { Card, Button, Badge, Skeleton, EmptyState, PageHeader } from '../components/ui/Primitives';
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
  'w-full min-h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] outline-none transition-all placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]';

const ESTADO_TABS: Array<{ value: EstadoVacuna | ''; label: string }> = [
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
];

const Vacunas: React.FC = () => {
  const qc = useQueryClient();
  const { pacientes } = usePacientes();
  const [pacienteId, setPacienteId] = useState('');
  const [pacienteQuery, setPacienteQuery] = useState('');
  const [showPacienteOptions, setShowPacienteOptions] = useState(false);
  const [especie, setEspecie] = useState('');
  const [estado, setEstado] = useState<EstadoVacuna | ''>('');
  const [tipo, setTipo] = useState('');

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

  const pacientesFiltrados = useMemo(() => {
    if (!pacienteQuery) return pacientes.slice(0, 8);
    const q = pacienteQuery.toLowerCase();
    return pacientes
      .filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          (p.propietario?.nombre ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [pacienteQuery, pacientes]);

  const seleccionarPaciente = (p: Paciente) => {
    setPacienteId(p.id ?? '');
    setPacienteQuery(p.nombre);
    setShowPacienteOptions(false);
  };

  const onPacienteQueryChange = (value: string) => {
    setPacienteQuery(value);
    setShowPacienteOptions(true);
    if (!value) {
      setPacienteId('');
      return;
    }
    const match = pacientes.find((p) => p.nombre.toLowerCase() === value.toLowerCase());
    setPacienteId(match?.id ?? '');
  };

  const limpiarFiltros = () => {
    setPacienteId('');
    setPacienteQuery('');
    setEspecie('');
    setEstado('');
    setTipo('');
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-4 animate-fade-in py-4">
      <PageHeader
        title="Vacunación"
        action={
          <Link
            to="/pacientes"
            className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-bold transition-all shrink-0"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Pacientes
          </Link>
        }
      />

      <Card padding="sm" data-tour="vacunas-control">
        <div role="tablist" aria-label="Filtrar por estado" className="flex flex-wrap items-center gap-1.5">
          {ESTADO_TABS.map((item) => {
            const active = estado === item.value;
            return (
              <button
                key={item.value || 'todos'}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setEstado(item.value)}
                className="rounded-full px-3 py-1 text-xs font-bold transition-all"
                style={{
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid items-end gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(160px,1fr)_130px_minmax(140px,1fr)_auto]">
          <div className="relative grid gap-1 text-xs font-bold text-slate-500">
            Paciente
            <input
              aria-label="Filtrar por paciente"
              value={pacienteQuery}
              onChange={(e) => onPacienteQueryChange(e.target.value)}
              onFocus={() => setShowPacienteOptions(true)}
              onBlur={() => setTimeout(() => setShowPacienteOptions(false), 120)}
              placeholder="Mascota o propietario..."
              autoComplete="off"
              className={inputClasses}
            />
            {showPacienteOptions && pacientesFiltrados.length > 0 && (
              <ul className="absolute top-full z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-lg">
                {pacientesFiltrados.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        seleccionarPaciente(p);
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--accent-soft)]"
                    >
                      {p.nombre}
                      {p.propietario?.nombre && (
                        <span className="ml-1 text-xs text-slate-400">· {p.propietario.nombre}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="grid gap-1 text-xs font-bold text-slate-500">
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

          <label className="grid gap-1 text-xs font-bold text-slate-500">
            Tipo
            <input
              aria-label="Filtrar por tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="Rabia o código"
              className={inputClasses}
            />
          </label>

          <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
            Limpiar
          </Button>
        </div>

        {vacunas.isLoading ? (
          <div className="mt-4 grid gap-2">
            <Skeleton height={40} />
            <Skeleton height={40} />
            <Skeleton height={40} />
          </div>
        ) : lista.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              titulo="Sin vacunas para los filtros"
              mensaje="Ajusta el filtro o vuelve a todos los estados para revisar el calendario preventivo completo."
              icon={<Syringe className="h-5 w-5" />}
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="py-1.5 pr-3">Paciente</th>
                  <th className="py-1.5 pr-3">Especie</th>
                  <th className="py-1.5 pr-3">Vacuna</th>
                  <th className="py-1.5 pr-3">Próx. dosis</th>
                  <th className="py-1.5 pr-3">Estado</th>
                  <th className="py-1.5 pr-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                    <td className="py-2 pr-3">
                      <Link to={`/pacientes/${v.pacienteId}`} className="font-bold text-accent hover:underline">
                        {pacienteNombre(v.pacienteId)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-slate-500">{v.especie ?? 'n/d'}</td>
                    <td className="py-2 pr-3 text-slate-800">{v.nombre}</td>
                    <td className="py-2 pr-3 text-slate-500">
                      {v.aplicada ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Aplicada {fechaCorta(v.aplicada)}
                        </span>
                      ) : (
                        fechaCorta(v.proximaDosis)
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge estado={v.estado} size="sm">
                        {etiquetaEstadoVacuna(v.estado)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={aplicar.isPending}
                        onClick={() => aplicar.mutate(v)}
                      >
                        Marcar aplicada
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Vacunas;
export { Vacunas };
