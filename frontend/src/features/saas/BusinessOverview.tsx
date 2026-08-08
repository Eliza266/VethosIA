import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Calendar, CreditCard, FileText, Gauge, Sparkles, Users } from 'lucide-react';
import { miSuscripcion, listarPlanes } from './api';
import { obtenerConsumo } from '../metricas/api';
import { Badge, Card, Skeleton } from '../../components/ui/Primitives';
import { puedeGestionarSuscripcion, type RbacProfileLike, type Rol } from '../../lib/rbac';
import {
  consumoPorcentaje,
  consumoScopeLabel,
  estadoCuentaVisual,
  formatBusinessDate,
} from './business';

interface BusinessOverviewProps {
  rol?: Rol | null;
  profile?: RbacProfileLike | null;
  compact?: boolean;
}

const cardDato = (
  icon: React.ReactNode,
  label: string,
  value: React.ReactNode,
  badgeText?: string,
  accentColor: string = 'border-slate-200 bg-white',
) => (
  <div className={`rounded-2xl border ${accentColor} p-4 shadow-sm transition-all hover:shadow-md flex flex-col justify-between`}>
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      {badgeText && (
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-800">
          {badgeText}
        </span>
      )}
    </div>
    <div className="text-lg font-black text-slate-900 break-words">{value}</div>
  </div>
);

const resolveHumanPlanName = (
  rawName: string | null | undefined,
  rawId: string | null | undefined,
  planesList?: Array<{ id: string; nombre: string }>,
): string => {
  if (rawName && rawName.trim() && !rawName.includes('jljetj') && rawName.length < 35) {
    return rawName;
  }
  if (!rawId) return 'Clínica Start (Trial Gratuito)';
  const cleanId = rawId.trim();
  if (planesList) {
    const found = planesList.find((p) => p.id === cleanId || p.nombre.toLowerCase() === cleanId.toLowerCase());
    if (found) return found.nombre;
  }
  if (cleanId === 'clinica_enterprise' || cleanId.includes('enterprise')) return 'Clínica Enterprise';
  if (cleanId === 'clinica_pro' || cleanId.includes('pro')) return 'Clínica Pro';
  if (cleanId === 'vet_individual' || cleanId.includes('individual')) return 'Veterinario Individual';
  if (cleanId === 'clinica_start' || cleanId.includes('start')) return 'Clínica Start';
  return 'Clínica Pro';
};

const BusinessOverview: React.FC<BusinessOverviewProps> = ({ rol, profile, compact = false }) => {
  const suscripcion = useQuery({
    queryKey: ['suscripcion-me'],
    queryFn: miSuscripcion,
    retry: false,
  });
  const consumo = useQuery({
    queryKey: ['consumo'],
    queryFn: obtenerConsumo,
    retry: false,
  });
  const planes = useQuery({
    queryKey: ['planes-overview'],
    queryFn: listarPlanes,
    retry: false,
  });

  const sub = suscripcion.data?.suscripcion ?? null;
  const asientos = suscripcion.data?.asientos ?? null;
  const estado = estadoCuentaVisual(sub?.estado);
  const porcentaje = consumoPorcentaje(consumo.data);
  const planLabel = resolveHumanPlanName(sub?.planNombre, sub?.planId, planes.data);
  const vigenteHasta = formatBusinessDate(sub?.vigenteHasta);
  const trialHasta = formatBusinessDate(sub?.trialHasta);
  const limite = consumo.data?.limite ?? sub?.limiteHistoriasMes ?? null;
  const puedeGestionarPlan = puedeGestionarSuscripcion(profile ?? rol);

  return (
    <Card className={compact ? 'p-5' : undefined}>
      <section aria-label="Resumen de negocio" className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent ring-1 ring-accent/10">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Plan, consumo y estado</h2>
              <p className="mt-1 text-sm text-slate-500">
                <span>{consumoScopeLabel(rol)}</span>
                <span> con datos reales de la cuenta activa.</span>
              </p>
            </div>
          </div>
          <Badge estado={estado.badgeEstado}>{estado.label}</Badge>
        </div>

        {suscripcion.isLoading && <Skeleton height={40} />}
        {!suscripcion.isLoading && suscripcion.isError && (
          <p role="alert" className="text-sm font-medium text-red-600">
            No fue posible cargar la suscripción.
          </p>
        )}

        {!suscripcion.isLoading && !suscripcion.isError && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cardDato(
              <Sparkles className="h-4 w-4 text-purple-600" />,
              'Plan Actual',
              planLabel,
              sub?.estado === 'trial_activa' ? 'Trial Activo' : 'Activo',
              'border-purple-200/60 bg-purple-50/20',
            )}
            {cardDato(
              <FileText className="h-4 w-4 text-blue-600" />,
              'Consultas IA Incluidas',
              typeof limite === 'number' ? `${limite.toLocaleString('es-CO')} / mes` : 'Sin límite',
              'Límite Mes',
              'border-blue-200/60 bg-blue-50/20',
            )}
            {cardDato(
              <Calendar className="h-4 w-4 text-emerald-600" />,
              'Vigencia',
              vigenteHasta ?? trialHasta ?? 'Sin vencimiento',
              undefined,
              'border-emerald-200/60 bg-emerald-50/20',
            )}
            {cardDato(
              <Users className="h-4 w-4 text-amber-600" />,
              'Asientos Licencias',
              asientos ? `${asientos.usados} de ${asientos.max}` : '1 asiento',
              'Miembros',
              'border-amber-200/60 bg-amber-50/20',
            )}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-bold text-slate-900">Consumo del período</h3>
            </div>
            {consumo.data?.periodo && (
              <span className="text-xs font-semibold text-slate-500">{consumo.data.periodo}</span>
            )}
          </div>

          {consumo.isLoading && <Skeleton height={28} />}
          {!consumo.isLoading && consumo.isError && (
            <p role="alert" className="text-sm text-slate-500">
              Consumo no disponible para este contexto.
            </p>
          )}
          {!consumo.isLoading && !consumo.isError && consumo.data && (
            <div className="space-y-3">
              <div
                role="progressbar"
                aria-label="Uso del plan"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={porcentaje}
                className="h-3 overflow-hidden rounded-full bg-white ring-1 ring-slate-200/80"
              >
                <div
                  className={`h-full rounded-full ${consumo.data.bloqueado ? 'bg-red-500' : consumo.data.alcanzo80 ? 'bg-amber-500' : 'bg-accent'}`}
                  style={{ width: `${porcentaje}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                <span>
                  {consumo.data.usados} usados
                  {typeof limite === 'number' ? ` de ${limite}` : ''}
                </span>
                <span className="font-bold text-slate-800">{porcentaje}%</span>
              </div>
              {(consumo.data.alcanzo80 || consumo.data.bloqueado) && (
                <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                  consumo.data.bloqueado
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {consumo.data.bloqueado
                      ? 'Consumo bloqueado por límite alcanzado.'
                      : 'Alerta: consumo alto del plan.'}
                  </span>
                </div>
              )}
            </div>
          )}
          {!consumo.isLoading && !consumo.isError && !consumo.data && (
            <p className="text-sm text-slate-500">Aún no hay consumo registrado para este período.</p>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {rol === 'admin_veterinaria' && !puedeGestionarPlan
              ? 'Plan heredado de la entidad. Puedes consultar el estado, pero la gestión de pagos pertenece al admin de entidad.'
              : estado.detalle}
          </p>
          {puedeGestionarPlan && (
            <Link
              to="/suscripcion"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-sm font-bold text-accent transition-colors hover:border-accent/40 hover:bg-accent/10 sm:w-auto"
            >
              Gestionar suscripción
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </section>
    </Card>
  );
};

export default BusinessOverview;
export { BusinessOverview };
