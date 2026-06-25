import React from 'react';
import { ReceiptText } from 'lucide-react';
import { Badge, Card, EmptyState, Skeleton } from '../../components/ui/Primitives';
import type { CarteraCuenta, PagoLigero, PagosConfigResponse, ReciboLigero } from './api';
import { estadoCuentaVisual, formatBusinessDate, formatCOPFromCents, pagosEnLineaLabel } from './business';

interface BillingSummaryProps {
  pagos?: PagoLigero[];
  recibos?: ReciboLigero[];
  cartera?: CarteraCuenta | null;
  pagosConfig?: PagosConfigResponse | null;
  isLoading?: boolean;
  estadoSuscripcion?: string | null;
}

function estadoPagoLabel(status: string | null | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'approved':
    case 'aprobado':
    case 'paid':
    case 'emitido':
      return 'Pagado';
    case 'pending':
    case 'pendiente':
      return 'Pendiente';
    case 'declined':
    case 'rechazado':
    case 'failed':
      return 'Rechazado';
    default:
      return status ?? 'Sin estado';
  }
}

function estadoPagoBadge(status: string | null | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'approved':
    case 'aprobado':
    case 'paid':
    case 'emitido':
      return 'activa';
    case 'pending':
    case 'pendiente':
      return 'por_vencer';
    case 'declined':
    case 'rechazado':
    case 'failed':
      return 'vencida';
    default:
      return 'neutral';
  }
}

const BillingSummary: React.FC<BillingSummaryProps> = ({
  pagos = [],
  recibos,
  cartera,
  pagosConfig,
  isLoading = false,
  estadoSuscripcion,
}) => {
  const estadoCuenta = estadoCuentaVisual(cartera?.estado ?? estadoSuscripcion);
  const items: Array<PagoLigero | ReciboLigero> = recibos ?? pagos;
  const pagosLabel = pagosEnLineaLabel(pagosConfig?.estado);

  return (
    <Card>
      <section aria-label="Estado de cuenta y pagos" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200/80">
              <ReceiptText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Estado de cuenta y pagos</h2>
              <p className="mt-1 text-sm text-slate-500">
                {estadoCuenta.detalle} Los recibos se muestran solo cuando existen registros confirmados.
              </p>
              {pagosConfig && (
                <p
                  className={`mt-2 text-xs font-semibold ${
                    pagosConfig.checkoutDisponible ? 'text-accent' : 'text-amber-700'
                  }`}
                >
                  {pagosLabel}
                  {!pagosConfig.checkoutDisponible && pagosConfig.puedeConfigurar
                    ? '. Configura Wompi abajo para habilitar checkout.'
                    : ''}
                </p>
              )}
              {cartera?.requierePago && (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  {cartera.diasVencido > 0
                    ? `${cartera.diasVencido} días de vencimiento registrados.`
                    : 'Hay un saldo o ciclo pendiente de regularización.'}
                </p>
              )}
            </div>
          </div>
          <Badge estado={estadoCuenta.badgeEstado}>{estadoCuenta.label}</Badge>
        </div>

        {isLoading && <Skeleton height={48} />}
        {!isLoading && items.length === 0 && (
          <EmptyState
            variant="controlled"
            titulo="Sin recibos recientes"
            mensaje="No hay recibos confirmados para mostrar. Cuando un pago aprobado sea procesado, aparecerá aquí con su referencia y estado."
          />
        )}
        {!isLoading && items.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/40 px-3">
            {items.slice(0, 5).map((pago, index) => {
              const fecha = formatBusinessDate('fechaEmision' in pago ? pago.fechaEmision : pago.createdAt ?? pago.creadoEn);
              const id = pago.reference ?? pago.transactionId ?? pago.id ?? `pago-${index + 1}`;
              const status = 'estado' in pago ? pago.estado : pago.status;
              return (
                <li key={id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-bold text-slate-800">{id}</p>
                    <p className="text-xs text-slate-500">{fecha ?? 'Fecha no disponible'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">
                      {formatCOPFromCents(pago.amountInCents)}
                    </span>
                    <Badge estado={estadoPagoBadge(status)}>{estadoPagoLabel(status)}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Card>
  );
};

export default BillingSummary;
export { BillingSummary };
