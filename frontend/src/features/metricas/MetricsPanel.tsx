import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { obtenerMetricas, obtenerConsumo } from './api';
import { listarVeterinariosBackoffice, listarVeterinariasBackoffice } from '../backoffice/api';
import { Card, SectionHeader, Skeleton } from '../../components/ui/Primitives';
import type { Rol } from '../../lib/rbac';
import { NAVY, CYAN, LIME, RED, ESPECIES_COLORS, VACUNAS_COLORS, AGENDA_COLORS, BRIGADAS_COLORS } from '../../lib/chartColors';

const RANGOS = [
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: '180', label: 'Últimos 6 meses' },
  { value: '365', label: 'Último año' },
  { value: '', label: 'Todo' },
] as const;

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
};

const axisTick = { fontSize: 10, fill: 'var(--muted)' };

const labelMes = (mes: string): string => {
  const [anio, mesNum] = mes.split('-');
  const fecha = new Date(Number(anio), Number(mesNum) - 1, 1);
  return fecha.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
};

const fechaDesde = (dias: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
};

interface DonutDatum {
  nombre: string;
  valor: number;
}

const DonutCard: React.FC<{ titulo: string; subtitulo?: string; datos: DonutDatum[]; colores: string[] }> = ({
  titulo,
  subtitulo,
  datos,
  colores,
}) => {
  const conDatos = datos.filter((d) => d.valor > 0);
  const total = conDatos.reduce((acc, d) => acc + d.valor, 0);
  const principal = conDatos[0];
  const porcentajePrincipal = principal && total > 0 ? Math.round((principal.valor / total) * 100) : 0;
  return (
    <Card className="premium-card" padding="sm">
      <h3 className="text-sm font-black text-[var(--text)]">{titulo}</h3>
      {subtitulo && <p className="text-[11px] font-semibold text-[var(--muted)]">{subtitulo}</p>}
      {conDatos.length > 0 ? (
        <>
          <div className="relative mt-2 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={conDatos} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={3} dataKey="valor">
                  {conDatos.map((entry, index) => (
                    <Cell key={entry.nombre} fill={colores[index % colores.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-black text-[var(--text)]">{porcentajePrincipal}%</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {conDatos.map((d, i) => (
              <span key={d.nombre} className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colores[i % colores.length] }} />
                {d.nombre} ({Math.round((d.valor / total) * 100)}%)
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-2 flex h-36 items-center justify-center text-xs text-[var(--muted)]">Sin datos todavía.</div>
      )}
    </Card>
  );
};

// Panel de metricas + consumo, con graficos (recharts) en vez de listas planas. Alcance
// segun rol (Super Admin: global; Admin entidad/veterinaria: su alcance; Vet: individual).
// admin_veterinaria puede ademas aterrizar en un veterinario puntual de su equipo.
const MetricsPanel: React.FC<{ rol?: Rol | null }> = ({ rol }) => {
  const [rango, setRango] = useState<string>('180');
  const [veterinarioId, setVeterinarioId] = useState<string>('');
  const [veterinariaId, setVeterinariaId] = useState<string>('');
  const desde = rango ? fechaDesde(Number(rango)) : undefined;

  const esAdminVeterinaria = rol === 'admin_veterinaria';
  const esAdminEntidad = rol === 'admin_entidad';

  const equipo = useQuery({
    queryKey: ['metricas-equipo'],
    queryFn: listarVeterinariosBackoffice,
    enabled: esAdminVeterinaria,
  });

  const sedes = useQuery({
    queryKey: ['metricas-sedes'],
    queryFn: listarVeterinariasBackoffice,
    enabled: esAdminEntidad,
  });

  const metricas = useQuery({
    queryKey: ['metricas', desde, veterinarioId, veterinariaId],
    queryFn: () =>
      obtenerMetricas({ desde, veterinarioId: veterinarioId || undefined, veterinariaId: veterinariaId || undefined }),
  });
  const consumo = useQuery({ queryKey: ['consumo'], queryFn: obtenerConsumo });

  if (metricas.isLoading) {
    return (
      <Card>
        <Skeleton height={20} width={180} />
      </Card>
    );
  }
  if (metricas.isError || !metricas.data) {
    return (
      <Card>
        <div style={{ color: 'var(--muted)' }}>No se pudieron cargar las métricas.</div>
      </Card>
    );
  }

  const m = metricas.data;
  const c = consumo.data;
  const topDiagnosticos = [...(m.topDiagnosticos ?? [])].reverse(); // barras horizontales: el mayor arriba
  const especies = (m.distribucionEspecies ?? []).map((e) => ({ nombre: e.clave, valor: e.total }));
  const pacientesPorMes = m.pacientesPorMes ?? [];
  const consultasPorMes = m.consultasPorMes ?? [];
  const serieMensual = pacientesPorMes.map((p, i) => ({
    mes: labelMes(p.mes),
    Pacientes: p.total,
    Consultas: consultasPorMes[i]?.total ?? 0,
  }));
  const consultasPorVet = m.consultasPorVeterinario ?? [];
  const consumoPorVet = m.consumoIaPorVeterinario ?? [];
  const consolidadoSedes = m.consolidadoVeterinarias ?? [];
  const nombresSedes = new Map((sedes.data ?? []).map((v) => [v.id, v.nombre]));
  const sedeLabel = (id: string) => nombresSedes.get(id) ?? id;
  const nombresEquipo = new Map((equipo.data ?? []).map((v) => [v.uid, v.email ?? v.uid]));
  const equipoLabel = (id: string) => nombresEquipo.get(id) ?? (id === 'sin_veterinario' ? 'Sin asignar' : id);
  const consumoPorVetMap = new Map(consumoPorVet.map((v) => [v.veterinarioId, v.usados]));
  const rendimientoPorVet = consultasPorVet.map((v) => ({
    nombre: equipoLabel(v.veterinarioId),
    Consultas: v.total,
    'Historias IA': consumoPorVetMap.get(v.veterinarioId) ?? 0,
  }));
  const mostrarRendimiento = esAdminVeterinaria && !veterinarioId && rendimientoPorVet.length > 0;

  const vacunacionDatos: DonutDatum[] = [
    { nombre: 'Al día', valor: m.vacunasAlDia ?? 0 },
    { nombre: 'Próximas', valor: m.vacunasProximas ?? 0 },
    { nombre: 'Vencidas', valor: m.vacunasVencidas ?? 0 },
  ];
  const agendaDatos: DonutDatum[] = [
    { nombre: 'Realizadas', valor: m.citasRealizadas ?? 0 },
    { nombre: 'Programadas', valor: m.citasProgramadas ?? 0 },
    { nombre: 'No asistió', valor: m.citasNoAsistio ?? 0 },
    { nombre: 'Canceladas', valor: m.citasCanceladas ?? 0 },
  ];
  const brigadasDatos: DonutDatum[] = [
    { nombre: 'Planificadas', valor: m.brigadasPlanificadas ?? 0 },
    { nombre: 'En curso', valor: m.brigadasEnCurso ?? 0 },
    { nombre: 'Finalizadas', valor: m.brigadasFinalizadas ?? 0 },
  ];

  const usadosIa = m.soapUsados ?? c?.usados ?? 0;
  const limiteIa = m.soapLimite ?? c?.limite ?? 0;
  const porcentajeIa = limiteIa > 0 ? Math.min(100, Math.round((usadosIa / limiteIa) * 100)) : 0;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {esAdminEntidad && (
          <select
            value={veterinariaId}
            onChange={(e) => setVeterinariaId(e.target.value)}
            aria-label="Ver métricas de sede"
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-accent"
          >
            <option value="">Ver: Todas las sedes</option>
            {(sedes.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        )}
        {esAdminVeterinaria && (
          <select
            value={veterinarioId}
            onChange={(e) => setVeterinarioId(e.target.value)}
            aria-label="Ver métricas de"
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-accent"
          >
            <option value="">Ver: Todo el equipo</option>
            {(equipo.data ?? []).map((v) => (
              <option key={v.uid} value={v.uid}>
                {v.email ?? v.uid}
              </option>
            ))}
          </select>
        )}
        <select
          value={rango}
          onChange={(e) => setRango(e.target.value)}
          aria-label="Rango de fechas"
          className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-accent"
        >
          {RANGOS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card padding="sm">
          <span className="mb-1 inline-block h-1.5 w-5 rounded-full" style={{ background: NAVY }} />
          <div className="text-[10px] font-semibold leading-tight text-[var(--muted)] sm:text-xs">Cantidad de pacientes</div>
          <div className="mt-1 text-lg font-black text-[var(--text)] sm:text-2xl">{m.pacientes}</div>
        </Card>
        <Card padding="sm">
          <span className="mb-1 inline-block h-1.5 w-5 rounded-full" style={{ background: CYAN }} />
          <div className="text-[10px] font-semibold leading-tight text-[var(--muted)] sm:text-xs">Cantidad de consultas</div>
          <div className="mt-1 text-lg font-black text-[var(--text)] sm:text-2xl">{m.consultas}</div>
        </Card>
        <Card padding="sm">
          <span className="mb-1 inline-block h-1.5 w-5 rounded-full" style={{ background: c?.bloqueado ? RED : LIME }} />
          <div className="text-[10px] font-semibold leading-tight text-[var(--muted)] sm:text-xs">Cupo de IA</div>
          <div className="mt-1 text-lg font-black text-[var(--text)] sm:text-2xl">
            {usadosIa}
            <span className="text-[10px] font-normal text-[var(--muted)] sm:text-sm"> /{limiteIa}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold text-[var(--muted)] sm:text-xs">
            <span>{porcentajeIa}%</span>
          </div>
          <div className="mt-1" style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)' }}>
            <div
              style={{
                height: 6,
                width: `${porcentajeIa}%`,
                borderRadius: 999,
                background: c?.bloqueado ? RED : LIME,
              }}
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="premium-card">
          <SectionHeader title="Evolución de pacientes y consultas" description="Últimos 6 meses." />
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serieMensual}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={25} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Consultas" stroke={NAVY} strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Pacientes" stroke={CYAN} strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="premium-card">
          <SectionHeader title="Top 5 diagnósticos" description="Consultas aprobadas en el rango seleccionado." />
          <div className="mt-4 h-52">
            {topDiagnosticos.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topDiagnosticos} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nombre" tick={axisTick} axisLine={false} tickLine={false} width={140} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {topDiagnosticos.map((entry, index) => (
                      <Cell key={entry.nombre} fill={index === topDiagnosticos.length - 1 ? NAVY : CYAN} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">Sin diagnósticos todavía.</div>
            )}
          </div>
        </Card>
      </div>

      {/* 4 donas base en una fila de hasta 4 columnas; la 5ta tarjeta (rendimiento de
          equipo, solo admin_veterinaria con drill-down) cae a su propia fila en vez de
          apretar 5 columnas en la misma linea. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DonutCard titulo="Distribución por especie" datos={especies} colores={ESPECIES_COLORS} />
        <DonutCard titulo="Estado de vacunación" datos={vacunacionDatos} colores={VACUNAS_COLORS} />
        <DonutCard titulo="Eficiencia de agenda" datos={agendaDatos} colores={AGENDA_COLORS} />
        <DonutCard
          titulo="Estado de brigadas"
          subtitulo={`${m.brigadasParticipantes ?? 0} ${m.brigadasParticipantes === 1 ? 'participante' : 'participantes'} en total`}
          datos={brigadasDatos}
          colores={BRIGADAS_COLORS}
        />
        {mostrarRendimiento && (
          <Card className="premium-card sm:col-span-2 lg:col-span-4" padding="sm">
            <h3 className="text-sm font-black text-[var(--text)]">Rendimiento y uso de IA</h3>
            <div className="mt-2 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rendimientoPorVet}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="nombre" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="Consultas" fill={NAVY} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Historias IA" fill={LIME} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* Solo tiene sentido comparar sedes cuando hay mas de una — con una sola sede
          (el caso de la mayoria de admin_veterinaria/veterinario) esto seria una sola
          barra comparandose contra si misma, sin valor informativo. */}
      {!veterinariaId && consolidadoSedes.length > 1 && (
        <Card className="premium-card">
          <SectionHeader title="Consolidado por sede" description="Pacientes y consultas de cada veterinaria." />
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={consolidadoSedes.map((s) => ({ nombre: sedeLabel(s.veterinariaId), Pacientes: s.pacientes, Consultas: s.consultas }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="nombre" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={25} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Consultas" fill={NAVY} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Pacientes" fill={CYAN} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
};

export default MetricsPanel;
export { MetricsPanel };
