import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import {
  miSuscripcion,
  crearCheckout,
  listarPlanes,
  estadoCuentaPagos,
  pagosConfigMe,
  type CicloFacturacion,
} from '../features/saas/api';
import { BusinessOverview } from '../features/saas/BusinessOverview';
import { BillingSummary } from '../features/saas/BillingSummary';
import { WompiConfigPanel } from '../features/saas/WompiConfigPanel';
import { checkoutHabilitado } from '../features/saas/business';
import { useMe } from '../features/tenant/hooks';
import { Card, Button, Skeleton } from '../components/ui/Primitives';
import { getErrorMessage } from '../lib/errors';
import { puedeGestionarSuscripcion } from '../lib/rbac';

const Suscripcion: React.FC = () => {
  const { data: me } = useMe();
  const sub = useQuery({ queryKey: ['suscripcion-me'], queryFn: miSuscripcion });
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
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.45)]">
        <p className="text-xs font-bold uppercase tracking-wider text-[#0F6E56]">Cuenta y plan</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Suscripción</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Plan, consumo, estado de cuenta y checkout seguro para la cuenta activa.
        </p>
      </div>

      <BusinessOverview rol={me?.role ?? me?.rol} profile={me ?? null} />
      <BillingSummary
        estadoSuscripcion={sub.data?.suscripcion?.estado}
        cartera={cuentaPagos.data?.cartera ?? null}
        recibos={cuentaPagos.data?.recibos ?? []}
        pagosConfig={pagosConfig.data ?? null}
        isLoading={cuentaPagos.isLoading || pagosConfig.isLoading}
      />

      {puedeGestionarPlan && pagosConfig.data && <WompiConfigPanel config={pagosConfig.data} />}

      {puedeGestionarPlan ? (
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
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10"
                >
                  <option value="">Seleccionar plan...</option>
                  {activos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} - ${p.precioMensualCOP.toLocaleString('es-CO')}/mes
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
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/10"
                >
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </label>
              {planSel && (
                <p className="md:col-span-2 text-sm text-slate-500">
                  Precio de referencia ({ciclo}): $
                  {(ciclo === 'anual' ? planSel.precioAnualCOP : planSel.precioMensualCOP).toLocaleString('es-CO')}{' '}
                  COP. El monto real lo confirma el servidor.
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
            <div className="rounded-xl border border-[#0F6E56]/15 bg-[#0F6E56]/5 p-4 text-sm text-slate-600">
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
