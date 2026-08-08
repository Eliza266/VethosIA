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
import { CalendarClock, Sparkles, Stethoscope, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { obtenerMetricas, obtenerConsumo } from './api';
import { listarVeterinariosBackoffice, listarVeterinariasBackoffice } from '../backoffice/api';
import { Card, SectionHeader, Skeleton } from '../../components/ui/Primitives';
import type { Rol } from '../../lib/rbac';
import { BRAND_BLUE, CYAN, LIME, RED, ESPECIES_COLORS, VACUNAS_COLORS, AGENDA_COLORS, BRIGADAS_COLORS } from '../../lib/chartColors';

const RANGOS = [
  { value: 'hoy', label: 'Hoy' },
  { value: '7', label: 'Última semana' },
  { value: '30', label: 'Últimos 30 días' },
  { value: '90', label: 'Últimos 90 días' },
  { value: '180', label: 'Últimos 6 meses' },
  { value: '365', label: 'Último año' },
  { value: 'todo', label: 'Todo' },
  { value: 'personalizado', label: 'Personalizado…' },
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

// % de cambio vs. el periodo anterior de igual duracion. null = sin base de comparacion
// (periodo anterior en cero, o rango "Todo" sin limite inferior).
const calcDelta = (actual: number, anterior: number | undefined): number | null => {
  if (anterior === undefined || anterior === 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
};

const DeltaBadge: React.FC<{ deltaPct: number | null }> = ({ deltaPct }) =>
  deltaPct === null ? (
    <span className="text-[11px] font-semibold text-[var(--muted)]">Sin comparación</span>
  ) : (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold"
      style={{ color: deltaPct >= 0 ? 'var(--success)' : 'var(--danger)' }}
    >
      {deltaPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(deltaPct)}% vs. anterior
    </span>
  );

const MiniSparkline: React.FC<{ datos: Array<{ total: number }>; color: string }> = ({ datos, color }) =>
  datos.length > 1 ? (
    <div className="h-10 w-24 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos}>
          <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  ) : null;

/** Tarjeta KPI: icono grande + etiqueta arriba, numero grande, y una fila inferior
 * opcional (variacion vs. periodo anterior + mini-sparkline, o cualquier otro contenido
 * chico como la barra de progreso de Cupo de IA). */
const KpiCardShell: React.FC<{
  icon: React.ReactNode;
  label: string;
  accent: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}> = ({ icon, label, accent, value, children }) => (
  <Card padding="sm" className="!p-4">
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
      >
        {icon}
      </span>
      <span className="truncate text-sm font-bold text-[var(--text-secondary)]">{label}</span>
    </div>
    <div className="mt-2.5 text-3xl font-black leading-none text-[var(--text)]">{value}</div>
    {children}
  </Card>
);

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
  const [customDesde, setCustomDesde] = useState<string>('');
  const [customHasta, setCustomHasta] = useState<string>('');
  const [veterinarioId, setVeterinarioId] = useState<string>('');
  const [veterinariaId, setVeterinariaId] = useState<string>('');

  const hoyStr = new Date().toISOString().slice(0, 10);
  let desde: string | undefined;
  let hasta: string | undefined;
  if (rango === 'personalizado') {
    desde = customDesde || undefined;
    hasta = customHasta || undefined;
  } else if (rango === 'todo') {
    desde = undefined;
    hasta = undefined;
  } else if (rango === 'hoy') {
    desde = hoyStr;
    hasta = hoyStr;
  } else {
    desde = fechaDesde(Number(rango));
    hasta = undefined;
  }

  // Periodo anterior de igual duracion, inmediatamente antes del actual — base para las
  // variaciones (%) de las tarjetas KPI. Sin "desde" (rango "Todo") no hay comparacion posible.
  const periodoAnterior = (() => {
    if (!desde) return null;
    const finActual = hasta ? new Date(`${hasta}T00:00:00`) : new Date();
    const inicioActual = new Date(`${desde}T00:00:00`);
    const duracionMs = Math.max(finActual.getTime() - inicioActual.getTime(), 0);
    const finAnterior = new Date(inicioActual.getTime() - 24 * 60 * 60 * 1000);
    const inicioAnterior = new Date(finAnterior.getTime() - duracionMs);
    return {
      desde: inicioAnterior.toISOString().slice(0, 10),
      hasta: finAnterior.toISOString().slice(0, 10),
    };
  })();

  const esAdminVeterinaria = rol === 'admin_veterinaria';
  const esAdminEntidad = rol === 'admin_entidad';

  const equipo = useQuery({
    queryKey: ['metricas-equipo'],
    queryFn: listarVeterinariosBackoffice,
    enabled: esAdminVeterinaria || esAdminEntidad,
  });

  const sedes = useQuery({
    queryKey: ['metricas-sedes'],
    queryFn: listarVeterinariasBackoffice,
    enabled: esAdminEntidad,
  });

  const metricas = useQuery({
    queryKey: ['metricas', desde, hasta, veterinarioId, veterinariaId],
    queryFn: () =>
      obtenerMetricas({ desde, hasta, veterinarioId: veterinarioId || undefined, veterinariaId: veterinariaId || undefined }),
  });
  const metricasAnterior = useQuery({
    queryKey: ['metricas-anterior', periodoAnterior?.desde, periodoAnterior?.hasta, veterinarioId, veterinariaId],
    queryFn: () =>
      obtenerMetricas({
        desde: periodoAnterior?.desde,
        hasta: periodoAnterior?.hasta,
        veterinarioId: veterinarioId || undefined,
        veterinariaId: veterinariaId || undefined,
      }),
    enabled: !!periodoAnterior,
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
  const topDiagnosticos = m.topDiagnosticos ?? []; // ya viene ordenado descendente desde el backend
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
  const mostrarRendimiento = (esAdminVeterinaria || esAdminEntidad) && !veterinarioId && rendimientoPorVet.length > 0;

  const vacunacionDatos: DonutDatum[] = [
    { nombre: 'Al día', valor: m.vacunasAlDia ?? 0 },
    { nombre: 'Próximas', valor: m.vacunasProximas ?? 0 },
    { nombre: 'Vencidas', valor: m.vacunasVencidas ?? 0 },
  ];
  const agendaDatos: DonutDatum[] = [
    { nombre: 'Realizadas', valor: m.citasRealizadas ?? 0 },
    { nombre: 'Programadas', valor: m.citasProgramadas ?? 0 },
    { nombre: 'En atención', valor: m.citasEnAtencion ?? 0 },
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

  const mAnt = metricasAnterior.data;
  const citasCerradas = (m.citasRealizadas ?? 0) + (m.citasNoAsistio ?? 0);
  const tasaAsistencia = citasCerradas > 0 ? Math.round(((m.citasRealizadas ?? 0) / citasCerradas) * 100) : null;
  const citasCerradasAnt = (mAnt?.citasRealizadas ?? 0) + (mAnt?.citasNoAsistio ?? 0);
  const tasaAsistenciaAnt =
    citasCerradasAnt > 0 ? Math.round(((mAnt?.citasRealizadas ?? 0) / citasCerradasAnt) * 100) : undefined;

  return (
    <div className="grid gap-4">
      {/* overflow-x-auto de respaldo: si algun select (p. ej. un correo largo de equipo)
          fuera mas ancho que la pantalla, que se desplace esta franja, no todo el dashboard. */}
      <div className="flex flex-wrap items-center justify-end gap-2 overflow-x-auto">
        {esAdminEntidad && (
          <select
            value={veterinariaId}
            onChange={(e) => setVeterinariaId(e.target.value)}
            aria-label="Ver métricas de sede"
            className="min-h-9 max-w-[45vw] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-accent sm:max-w-[220px]"
          >
            <option value="">Ver: Todas las sedes</option>
            {(sedes.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        )}
        {(esAdminVeterinaria || esAdminEntidad) && (
          <select
            value={veterinarioId}
            onChange={(e) => setVeterinarioId(e.target.value)}
            aria-label="Ver métricas de"
            className="min-h-9 max-w-[45vw] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-accent sm:max-w-[220px]"
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
          className="min-h-9 max-w-[45vw] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-accent sm:max-w-none"
        >
          {RANGOS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {rango === 'personalizado' && (
          <>
            <input
              type="date"
              value={customDesde}
              max={customHasta || hoyStr}
              onChange={(e) => setCustomDesde(e.target.value)}
              aria-label="Desde"
              className="min-h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-accent"
            />
            <span className="text-xs text-[var(--muted)]">–</span>
            <input
              type="date"
              value={customHasta}
              min={customDesde}
              max={hoyStr}
              onChange={(e) => setCustomHasta(e.target.value)}
              aria-label="Hasta"
              className="min-h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-accent"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* "Total pacientes" es un conteo acumulado (no se filtra por fecha en el backend
            a proposito: es el total de la cuenta, no algo que fluctue por periodo), asi
            que no tiene sentido mostrarle una variacion vs. periodo anterior — siempre
            daria 0%. Solo se muestra la mini-tendencia de altas por mes. */}
        <KpiCardShell icon={<Users className="h-5 w-5" />} label="Total pacientes" accent={BRAND_BLUE} value={m.pacientes}>
          <div className="mt-2 flex items-end justify-end gap-2">
            <MiniSparkline datos={pacientesPorMes} color={BRAND_BLUE} />
          </div>
        </KpiCardShell>
        <KpiCardShell icon={<Stethoscope className="h-5 w-5" />} label="Total consultas" accent={CYAN} value={m.consultas}>
          <div className="mt-2 flex items-end justify-between gap-2">
            <DeltaBadge deltaPct={calcDelta(m.consultas, mAnt?.consultas)} />
            <MiniSparkline datos={consultasPorMes} color={CYAN} />
          </div>
        </KpiCardShell>
        <KpiCardShell
          icon={<Sparkles className="h-5 w-5" />}
          label="Cupo de IA"
          accent={c?.bloqueado ? RED : LIME}
          value={
            <>
              {usadosIa}
              <span className="text-sm font-normal text-[var(--muted)]"> /{limiteIa}</span>
            </>
          }
        >
          <div className="mt-2" style={{ height: 6, borderRadius: 999, background: 'var(--surface-2)' }}>
            <div
              style={{
                height: 6,
                width: `${porcentajeIa}%`,
                borderRadius: 999,
                background: c?.bloqueado ? RED : LIME,
              }}
            />
          </div>
          <div className="mt-1 text-[11px] font-semibold text-[var(--muted)]">{porcentajeIa}% usado</div>
        </KpiCardShell>
        <KpiCardShell
          icon={<CalendarClock className="h-5 w-5" />}
          label="Tasa de asistencia"
          accent="var(--success)"
          value={tasaAsistencia !== null ? `${tasaAsistencia}%` : '—'}
        >
          <div className="mt-2">
            <DeltaBadge deltaPct={tasaAsistencia !== null ? calcDelta(tasaAsistencia, tasaAsistenciaAnt) : null} />
          </div>
        </KpiCardShell>
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
                <Line type="monotone" dataKey="Consultas" stroke={BRAND_BLUE} strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Pacientes" stroke={CYAN} strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="premium-card">
          <SectionHeader title="Top 5 diagnósticos" description="Consultas aprobadas en el rango seleccionado." />
          {/* Lista HTML en vez de grafico SVG: con la tarjeta angosta (va a media pantalla,
              al lado de la evolucion), el eje de categorias de Recharts recortaba los
              nombres a "..." ilegibles sin forma confiable de darles mas espacio. Con
              texto real se puede leer completo (truncate + title si no cabe) y a un
              tamano de letra normal, no los 9-10px que usaba el grafico. */}
          <div className="mt-4 space-y-3">
            {topDiagnosticos.length > 0 ? (
              (() => {
                const maxTotal = Math.max(...topDiagnosticos.map((d) => d.total), 1);
                return topDiagnosticos.map((d, index) => (
                  <div key={d.nombre} className="flex items-center gap-3">
                    <span className="w-2/5 shrink-0 truncate text-sm font-semibold text-[var(--text)]" title={d.nombre}>
                      {d.nombre}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div
                        className="h-3 rounded-full"
                        style={{ width: `${Math.max((d.total / maxTotal) * 100, 6)}%`, background: index === 0 ? BRAND_BLUE : CYAN }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-sm font-black text-[var(--text)]">{d.total}</span>
                  </div>
                ));
              })()
            ) : (
              <div className="flex h-40 items-center justify-center text-xs text-[var(--muted)]">Sin diagnósticos todavía.</div>
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
                  <Bar dataKey="Consultas" fill={BRAND_BLUE} radius={[3, 3, 0, 0]} />
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
                <Bar dataKey="Consultas" fill={BRAND_BLUE} radius={[4, 4, 0, 0]} />
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
