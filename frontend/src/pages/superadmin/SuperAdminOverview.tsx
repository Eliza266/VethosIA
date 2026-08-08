import React, { useMemo, useState } from 'react';
import {
  Building2,
  Users,
  DollarSign,
  FileText,
} from 'lucide-react';
import { Card, KpiCard, SectionHeader } from '../../components/ui/Primitives';
import type { SuperAdminDataset } from './types';
import { isVeterinario } from './utils';
import { ESPECIES_COLORS } from '../../lib/chartColors';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export const SuperAdminOverview: React.FC<{ data: SuperAdminDataset }> = ({ data }) => {
  const now = new Date();

  // Filtro de mes: por defecto el mes actual, pero el super admin puede mirar
  // meses anteriores. Solo mueve los KPIs y graficas "del mes"; el estado en
  // vivo (trial activo, bloqueadas) siempre refleja el momento real (`now`).
  const opcionesMes = useMemo(() => {
    const opciones: Array<{ value: string; label: string }> = [];
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
      opciones.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return opciones;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [currentPeriodStr, setCurrentPeriodStr] = useState(opcionesMes[0].value);
  const [periodoYear, periodoMesHumano] = currentPeriodStr.split('-').map(Number);
  const currentYear = periodoYear;
  const currentMonth = periodoMesHumano - 1; // 0-indexed, para calzar con Date.getMonth()

  // Helper to parse dates robustly
  function parseFirebaseDate(val: unknown): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (typeof val === 'string') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'number') return new Date(val);
    if (typeof val === 'object') {
      const obj = val as { seconds?: number; _seconds?: number };
      if (typeof obj.seconds === 'number') return new Date(obj.seconds * 1000);
      if (typeof obj._seconds === 'number') return new Date(obj._seconds * 1000);
    }
    return null;
  }

  // COP Currency formatter
  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(val);
  };

  // --- KPI Metrics ---
  const entidadesActivas = data.entidades.filter((e) => e.estado === 'activa').length;
  const veterinariosActivos = data.miembros.filter(
    (m) => isVeterinario(m) && !m.bloqueado && m.estado !== 'bloqueado' && m.estado !== 'inactivo'
  ).length;

  // SOAP del mes
  const consumosDelMes = data.consumos.filter((c) => c.periodo === currentPeriodStr);
  const soapDelMes = consumosDelMes.reduce((sum, c) => sum + (c.usados || 0), 0);

  // Ingresos del mes
  const pagosConfirmadosDelMes = data.pagos.filter((pago) => {
    const status = (pago.status || '').toUpperCase();
    const isApproved = status === 'APPROVED' || status === 'APROBADO' || status === 'SUCCESS' || status === 'PAGADO';
    if (!isApproved) return false;
    const date = parseFirebaseDate(pago.createdAt || pago.creadoEn);
    if (!date) return false;
    return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
  });
  const ingresosDelMes = pagosConfirmadosDelMes.reduce(
    (sum, pago) => sum + (pago.amountInCents ? pago.amountInCents / 100 : 0),
    0
  );

  // --- Secondary Metrics ---
  const cuentasEnTrial = data.suscripciones.filter((s) => {
    const estado = String(s.estado || s.status || '').toLowerCase();
    if (estado === 'trial') return true;
    if (s.trialHasta) {
      const trialDate = parseFirebaseDate(s.trialHasta);
      if (trialDate && trialDate > now) return true;
    }
    return false;
  }).length;

  const cuentasBloqueadas = data.miembros.filter((m) => m.bloqueado || m.estado === 'bloqueado').length;

  // Tiempo ahorrado
  const totalSoaps = data.consumos.reduce((acc, c) => acc + (c.usados || 0), 0);
  // Minutos ahorrados por SOAP = tiempo estándar de documentación manual (alcances B.4.9: 20–25 min,
  // configurable desde la config del sistema). TODO: leer de systemConfig cuando exista el campo.
  const MIN_AHORRADO_POR_SOAP = 20;
  const tiempoAhorradoTotalMinutos = totalSoaps * MIN_AHORRADO_POR_SOAP;
  const tiempoAhorradoHoras = Math.round(tiempoAhorradoTotalMinutos / 60);
  const tiempoAhorradoText = tiempoAhorradoHoras > 0 ? `${tiempoAhorradoHoras} h` : `${tiempoAhorradoTotalMinutos} min`;

  // Activación
  const totalCuentas = data.veterinarias.length;
  const cuentasConSoap = data.veterinarias.filter((v) => {
    const accountConsumos = data.consumos.filter(
      (c) => c.scopeId === v.id || c.veterinariaId === v.id || c.orgId === v.id
    );
    return accountConsumos.some((c) => c.usados > 0);
  }).length;
  const porcentajeActivacion = totalCuentas > 0 ? Math.round((cuentasConSoap / totalCuentas) * 100) : 0;

  // Nuevos registros
  const nuevosRegistrosMes = data.suscripciones.filter((s) => {
    const date = parseFirebaseDate(s.creadoEn || s.createdAt);
    if (!date) return false;
    return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
  }).length;

  // --- Charts Data ---
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('es-CO', { month: 'short' });
    last6Months.push({
      periodo: `${yyyy}-${mm}`,
      label: label.charAt(0).toUpperCase() + label.slice(1),
      SOAP: 0,
      usuarios: 0,
    });
  }

  last6Months.forEach((m) => {
    const periodConsumos = data.consumos.filter((c) => c.periodo === m.periodo);
    m.SOAP = periodConsumos.reduce((sum, c) => sum + (c.usados || 0), 0);
  });

  // Crecimiento real: cuentas (suscripciones) creadas hasta el fin de cada mes. Sin factores inventados.
  last6Months.forEach((m) => {
    const [yyyy, mm] = m.periodo.split('-').map(Number);
    const finMes = new Date(yyyy, mm, 0, 23, 59, 59);
    m.usuarios = data.suscripciones.filter((s) => {
      const date = parseFirebaseDate(s.creadoEn || s.createdAt);
      return date ? date <= finMes : false;
    }).length;
  });

  // Dona Chart Data
  const countEntidades = data.entidades.length;
  const countIndependientes = data.veterinarias.filter((v) => v.planOwnerType === 'veterinaria').length;
  const countIndividualVets = data.miembros.filter(
    (m) => m.planOwnerType === 'vet' || m.accountType === 'vet_individual'
  ).length;
  const totalIndependientes = countIndependientes + countIndividualVets;
  const distributionData = [
    { name: 'Entidades', value: countEntidades },
    { name: 'Independientes', value: totalIndependientes },
  ].filter((item) => item.value > 0);

  return (
    <div className="grid gap-5" data-testid="superadmin-overview-panel">
      {/* Filtro de mes: mueve los KPIs y graficas marcadas "del mes" / tendencia */}
      <div className="flex items-center justify-end">
        <label className="flex items-center gap-2 text-xs font-bold text-[var(--muted)]">
          Mes de referencia
          <select
            aria-label="Mes de referencia"
            value={currentPeriodStr}
            onChange={(e) => setCurrentPeriodStr(e.target.value)}
            className="min-h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text)] outline-none focus:border-accent"
          >
            {opcionesMes.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* 4 KPIs Principales */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Entidades activas" value={entidadesActivas} icon={<Building2 className="h-5 w-5" />} accent="default" />
        <KpiCard label="Veterinarios activos" value={veterinariosActivos} icon={<Users className="h-5 w-5" />} accent="info" />
        <KpiCard label="SOAP del mes" value={soapDelMes} icon={<FileText className="h-5 w-5" />} accent="success" />
        <KpiCard label="Ingresos del mes" value={formatCOP(ingresosDelMes)} icon={<DollarSign className="h-5 w-5" />} accent="success" />
      </section>

      {/* Métricas Secundarias */}
      <section className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <div className="metric-tile p-4 flex flex-col justify-between">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Trial activo</p>
          <strong className="mt-2 block text-2xl font-black text-[var(--text)]">{cuentasEnTrial}</strong>
        </div>
        <div className="metric-tile p-4 flex flex-col justify-between">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Bloqueadas</p>
          <strong className="mt-2 block text-2xl font-black text-[var(--text)]">{cuentasBloqueadas}</strong>
        </div>
        <div className="metric-tile p-4 flex flex-col justify-between">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Tiempo Ahorrado</p>
          <div>
            <strong className="mt-2 block text-2xl font-black text-[var(--text)]">{tiempoAhorradoText}</strong>
            <p className="text-[9px] text-[var(--muted)] mt-1">{totalSoaps} SOAP totales</p>
          </div>
        </div>
        <div className="metric-tile p-4 flex flex-col justify-between">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Activación</p>
          <div>
            <strong className="mt-2 block text-2xl font-black text-[var(--text)]">{porcentajeActivacion}%</strong>
            <p className="text-[9px] text-[var(--muted)] mt-1">Con ≥1 SOAP</p>
          </div>
        </div>
        <div className="metric-tile p-4 flex flex-col justify-between">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Registros mes</p>
          <strong className="mt-2 block text-2xl font-black text-[var(--text)]">{nuevosRegistrosMes}</strong>
        </div>
      </section>

      {/* Gráficas */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Gráfica 1: SOAP por mes */}
        <Card className="premium-card lg:col-span-2">
          <SectionHeader title="Notas SOAP generadas" description="Consumo de IA mensual (últimos 6 meses)" />
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last6Months}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={25} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="SOAP" radius={[4, 4, 0, 0]}>
                  {last6Months.map((m, index) => (
                    <Cell key={m.periodo} fill={ESPECIES_COLORS[index % ESPECIES_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Gráfica 3: Distribución */}
        <Card className="premium-card">
          <SectionHeader title="Distribución de Clientes" description="Entidades vs. Clínicas independientes" />
          <div className="h-64 mt-4 flex items-center justify-center">
            {distributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={entry.name} fill={ESPECIES_COLORS[index % ESPECIES_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-[var(--muted)]">Sin datos de distribución</p>
            )}
          </div>
        </Card>

        {/* Gráfica 2: Crecimiento de usuarios */}
        <Card className="premium-card lg:col-span-3">
          <SectionHeader title="Crecimiento de Usuarios" description="Evolución de cuentas activas en la plataforma" />
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last6Months}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={25} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="usuarios"
                  stroke="var(--clinical-blue)"
                  strokeWidth={3}
                  dot={{ fill: 'var(--clinical-blue)', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
