import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, ExternalLink, Gift, Receipt } from 'lucide-react';
import {
  miSuscripcion,
  crearCheckout,
  listarPlanes,
  estadoCuentaPagos,
  pagosConfigMe,
  type CicloFacturacion,
} from '../features/saas/api';
import { obtenerConsumo } from '../features/metricas/api';
import { BusinessOverview } from '../features/saas/BusinessOverview';
import { BillingSummary } from '../features/saas/BillingSummary';
import { PlanesWhatsAppGrid } from '../features/saas/PlanesWhatsApp';
import { checkoutHabilitado } from '../features/saas/business';
import { useMe } from '../features/tenant/hooks';
import { Card, Button, Skeleton, PageHeader } from '../components/ui/Primitives';
import { getErrorMessage } from '../lib/errors';
import { esVeterinarioVinculado, puedeGestionarSuscripcion } from '../lib/rbac';

const DIAS_TRIAL_TOTAL = 7;

const diasTrialRestantes = (trialHasta: unknown): number | null => {
  if (typeof trialHasta !== 'string') return null;
  const ms = new Date(trialHasta).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
};

const formatFecha = (valor: unknown): string | null => {
  if (typeof valor !== 'string') return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

const TrialBannerDots: React.FC<{ diaActual: number }> = ({ diaActual }) => (
  <div className="flex items-center gap-1.5">
    {Array.from({ length: DIAS_TRIAL_TOTAL }, (_, i) => (
      <span
        key={i}
        className={`h-2 w-2 rounded-full ${
          i < diaActual ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
        }`}
      />
    ))}
    <span className="ml-2 shrink-0 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-black text-white">
      Día {diaActual} de {DIAS_TRIAL_TOTAL}
    </span>
  </div>
);

const Suscripcion: React.FC = () => {
  const { data: me } = useMe();
  const [searchParams] = useSearchParams();
  const sub = useQuery({ queryKey: ['suscripcion-me'], queryFn: miSuscripcion });
  const consumo = useQuery({ queryKey: ['consumo-actual'], queryFn: obtenerConsumo, retry: false });
  const cuentaPagos = useQuery({ queryKey: ['pagos-me'], queryFn: estadoCuentaPagos, retry: false });
  const pagosConfig = useQuery({ queryKey: ['pagos-config-me'], queryFn: pagosConfigMe, retry: false });
  const planes = useQuery({ queryKey: ['planes-checkout'], queryFn: listarPlanes });
  const [error, setError] = useState('');
  const [planId, setPlanId] = useState('');
  const [ciclo, setCiclo] = useState<CicloFacturacion>('mensual');
  const [checkout, setCheckout] = useState<Awaited<ReturnType<typeof crearCheckout>> | null>(null);
  const [pagando, setPagando] = useState(false);

  const activos = (planes.data ?? []).filter((p) => p.activo);
  const planSel = activos.find((p) => p.id === planId);
  const checkoutOk = checkoutHabilitado(pagosConfig.data);
  const puedeGestionarPlan = puedeGestionarSuscripcion(me ?? null);
  // Un veterinario vinculado (no admin) ahora puede ver esta pagina para conocer el
  // plan de su equipo, pero el historial de pagos/cartera sigue siendo terreno del
  // admin de la clinica.
  const puedeVerFacturacion = !esVeterinarioVinculado(me ?? null);

  const estadoSub = sub.data?.suscripcion?.estado ?? null;
  const enTrial = estadoSub === 'trial_activa';
  const tienePlanActivo = Boolean(estadoSub) && !enTrial && estadoSub !== 'cancelada' && estadoSub !== 'desactivado';
  const mostrarPlanesForzado = searchParams.get('planes') === '1';
  const asientos = sub.data?.asientos ?? null;
  const vigenciaTexto = formatFecha(sub.data?.suscripcion?.vigenteHasta);

  const pagar = async () => {
    if (!checkoutOk) {
      setError('Pagos en línea no configurados para esta cuenta.');
      return;
    }
    if (!planId) {
      setError('Selecciona un plan.');
      return;
    }
    setError('');
    setPagando(true);
    try {
      const data = await crearCheckout({ planId, ciclo });
      setCheckout(data);
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo iniciar el pago.'));
    } finally {
      setPagando(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <PageHeader
        badge="Cuenta y plan"
        title="Suscripción"
        description={
          puedeVerFacturacion
            ? 'Plan, consumo, estado de cuenta y checkout seguro para la cuenta activa.'
            : 'Plan y consumo de tu clínica. La gestión y el historial de pagos los maneja tu administrador.'
        }
      />

      {enTrial && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_18%,var(--border))] bg-[linear-gradient(90deg,var(--accent-soft),color-mix(in_srgb,var(--clinical-cyan)_10%,var(--surface)))] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white">
              <Gift className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-black text-[var(--text)]">Estás en tu prueba gratuita</p>
              <p className="text-xs text-[var(--muted)]">Todas las funciones activas, sin necesidad de plan todavía.</p>
            </div>
          </div>
          {(() => {
            const restantes = diasTrialRestantes(sub.data?.suscripcion?.trialHasta);
            const diaActual = restantes !== null ? Math.min(DIAS_TRIAL_TOTAL, DIAS_TRIAL_TOTAL - restantes + 1) : null;
            return diaActual !== null ? <TrialBannerDots diaActual={diaActual} /> : null;
          })()}
        </div>
      )}

      {tienePlanActivo && (
        <div className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg [background:linear-gradient(135deg,var(--ink,#0e1116),#16233f_55%,var(--ink,#0e1116))]">
          <div className="pointer-events-none absolute inset-0 [background:radial-gradient(50%_70%_at_90%_0%,color-mix(in_srgb,var(--clinical-cyan)_18%,transparent),transparent_70%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9db3ff]">Tu plan actual</p>
              <p className="mt-1 text-xl font-black">{sub.data?.suscripcion?.planNombre ?? 'Plan activo'}</p>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
              ● Activo
            </span>
          </div>

          <div className="relative mt-3 flex items-baseline gap-2">
            {(() => {
              const planActual = activos.find((p) => p.id === sub.data?.suscripcion?.planId);
              return planActual ? (
                <>
                  <span className="text-3xl font-black">${planActual.precioMensualCOP.toLocaleString('es-CO')}</span>
                  <span className="text-xs text-[#b7c2e0]">COP / mes</span>
                </>
              ) : null;
            })()}
          </div>

          <div className="relative mt-5 grid gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-3">
            <div className="bg-white/[0.03] p-3.5">
              <p className="text-[11px] text-[#93a0c2]">Veterinarios</p>
              <p className="mt-1 text-base font-black">
                {asientos ? `${asientos.usados} / ${asientos.max}` : '—'}
              </p>
              {asientos && asientos.max > 0 && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full [background:linear-gradient(90deg,var(--clinical-cyan),var(--accent-strong))]"
                    style={{ width: `${Math.min(100, (asientos.usados / asientos.max) * 100)}%` }}
                  />
                </div>
              )}
            </div>
            <div className="bg-white/[0.03] p-3.5">
              <p className="text-[11px] text-[#93a0c2]">Pacientes este mes</p>
              <p className="mt-1 text-base font-black">
                {consumo.data ? `${consumo.data.usados} / ${consumo.data.limite}` : '—'}
              </p>
              {consumo.data && consumo.data.limite > 0 && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full [background:linear-gradient(90deg,var(--clinical-cyan),var(--accent-strong))]"
                    style={{ width: `${Math.min(100, consumo.data.porcentaje)}%` }}
                  />
                </div>
              )}
            </div>
            <div className="bg-white/[0.03] p-3.5">
              <p className="text-[11px] text-[#93a0c2]">Vigencia</p>
              <p className="mt-1 text-base font-black">{vigenciaTexto ?? 'Sin vencimiento'}</p>
            </div>
          </div>

          <div className="relative mt-5 flex flex-wrap gap-2.5">
            <a
              href="/suscripcion?planes=1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--clinical-cyan)] px-4 py-2.5 text-sm font-black text-[#05242e] transition hover:brightness-95"
            >
              <ExternalLink className="h-4 w-4" />
              Ver otros planes
            </a>
            {puedeVerFacturacion && (
              <a
                href="#estado-de-cuenta"
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <Receipt className="h-4 w-4" />
                Ver historial de pagos
              </a>
            )}
          </div>
        </div>
      )}

      <BusinessOverview rol={me?.role ?? me?.rol} profile={me ?? null} />
      {puedeVerFacturacion && (
        <div id="estado-de-cuenta" className="scroll-mt-20">
          <BillingSummary
            estadoSuscripcion={sub.data?.suscripcion?.estado}
            cartera={cuentaPagos.data?.cartera ?? null}
            recibos={cuentaPagos.data?.recibos ?? []}
            pagosConfig={pagosConfig.data ?? null}
            isLoading={cuentaPagos.isLoading || pagosConfig.isLoading}
          />
        </div>
      )}

      {!puedeGestionarPlan && !puedeVerFacturacion ? (
        <Card>
          <section aria-label="Plan del equipo" className="space-y-2">
            <h2 className="text-base font-black text-slate-900">Tu plan</h2>
            <p className="text-sm leading-6 text-slate-500">
              Esta es la información del plan de tu clínica. La gestión del plan y del
              historial de pagos la maneja el administrador de la veterinaria.
            </p>
          </section>
        </Card>
      ) : puedeGestionarPlan && (!checkoutOk || mostrarPlanesForzado) ? (
        <Card>
          <section aria-label="Planes disponibles" className="space-y-4">
            <div>
              <h2 className="text-base font-black text-[var(--text)]">Planes disponibles</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Elige el plan que más se ajuste a tu clínica y escríbenos por WhatsApp para activarlo.
              </p>
            </div>
            <PlanesWhatsAppGrid dark={false} />
          </section>
        </Card>
      ) : puedeGestionarPlan ? (
      <Card>
        <section aria-label="Pagar o cambiar plan" className="space-y-4">
          <div>
            <h2 className="text-base font-black text-slate-900">Pagar o cambiar plan</h2>
            <p className="mt-1 text-sm text-slate-500">
              El monto final, la referencia y la firma se calculan en el servidor antes de abrir Wompi.
            </p>
            {!checkoutOk && pagosConfig.data && (
              <p className="mt-2 text-sm font-medium text-amber-700">
                Pagos en línea no configurados. El checkout permanece deshabilitado hasta configurar Wompi.
              </p>
            )}
          </div>

          {planes.isLoading && <Skeleton height={40} />}
          {planes.isError && (
            <p role="alert" className="text-sm font-medium text-red-600">
              No se pudieron cargar los planes.
            </p>
          )}
          {!planes.isLoading && !planes.isError && activos.length === 0 && (
            <p className="text-sm text-slate-500">No hay planes disponibles en este momento.</p>
          )}
          {activos.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-800">Plan</span>
                <select
                  aria-label="Plan"
                  value={planId}
                  onChange={(e) => {
                    setPlanId(e.target.value);
                    setCheckout(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10"
                >
                  <option value="">Seleccionar plan...</option>
                  {activos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} - ${p.precioMensualCOP.toLocaleString('es-CO')} COP/mes
                      {p.precioMensualUSD ? ` (US$${p.precioMensualUSD.toLocaleString('en-US')}/mes)` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-bold text-slate-800">Ciclo de facturación</span>
                <select
                  aria-label="Ciclo de facturación"
                  value={ciclo}
                  onChange={(e) => {
                    setCiclo(e.target.value as CicloFacturacion);
                    setCheckout(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10"
                >
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </label>
              {planSel && (
                <p className="md:col-span-2 text-sm text-slate-500">
                  Precio de referencia ({ciclo}): $
                  {(ciclo === 'anual' ? planSel.precioAnualCOP : planSel.precioMensualCOP).toLocaleString('es-CO')}{' '}
                  COP
                  {(ciclo === 'anual' ? planSel.precioAnualUSD : planSel.precioMensualUSD)
                    ? ` (≈ US$${(ciclo === 'anual' ? planSel.precioAnualUSD! : planSel.precioMensualUSD!).toLocaleString('en-US')})`
                    : ''}
                  . El monto real lo confirma el servidor.
                </p>
              )}
            </div>
          )}

          <Button onClick={pagar} disabled={pagando || !planId || activos.length === 0 || !checkoutOk}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <CreditCard size={16} />
              {pagando ? 'Preparando pago...' : 'Iniciar pago con Wompi'}
            </span>
          </Button>
          {error && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          )}
          {checkout && (
            <div className="rounded-xl border border-accent/15 bg-accent/5 p-4 text-sm text-slate-600">
              <p>
                Checkout listo (referencia <code>{checkout.reference}</code>).
              </p>
              <p className="mt-1">
                Firma de integridad generada server-side. En producción se abre el widget de Wompi
                con esta referencia y firma.
              </p>
            </div>
          )}
        </section>
      </Card>
      ) : (
        <Card>
          <section aria-label="Suscripción heredada" className="space-y-2">
            <h2 className="text-base font-black text-slate-900">Suscripción solo lectura</h2>
            <p className="text-sm leading-6 text-slate-500">
              Esta veterinaria opera con un plan heredado. Puedes consultar consumo y estado de cuenta,
              pero no cambiar plan, pagar ni configurar Wompi desde este perfil.
            </p>
          </section>
        </Card>
      )}
    </div>
  );
};

export default Suscripcion;
export { Suscripcion };
