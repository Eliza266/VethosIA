import React from 'react';
import { Badge, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { PagoLigero } from '../../features/saas/api';
import type { SystemConfigPublicView } from '../../features/plataforma/api';
import { itemStyle, lineStyle, listStyle, text } from './utils';

export const PagosPanel: React.FC<{
  pagos: PagoLigero[];
  systemConfig?: SystemConfigPublicView;
}> = ({ pagos, systemConfig }) => {
  const wompi = systemConfig?.integrations.wompi;
  return (
    <div className="grid gap-5" data-testid="superadmin-pagos-panel">
      <Card className="premium-card">
        <SectionHeader
          title="Pagos y cobros"
          description="Vista de estado sin activar Wompi real ni checkout global. Las credenciales permanecen server-side."
        />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Wompi</p>
            <strong className="mt-1 block text-lg text-[var(--text)]">
              {wompi?.globalSecretsPresent ? 'Credenciales server-side presentes' : 'Credenciales pendientes'}
            </strong>
            <p className="mt-1 text-sm text-[var(--muted)]">No se muestra ni solicita ningún secreto desde frontend.</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Checkout global</p>
            <strong className="mt-1 block text-lg text-[var(--text)]">Deshabilitado</strong>
            <p className="mt-1 text-sm text-[var(--muted)]">Solo puede abrirse desde flujos tenant seguros cuando haya configuración aprobada.</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Base URL</p>
            <strong className="mt-1 block text-lg text-[var(--text)]">{wompi?.baseUrl ?? 'No reportada'}</strong>
            <p className="mt-1 text-sm text-[var(--muted)]">Estado informativo; no ejecuta cobros reales.</p>
          </div>
        </div>
      </Card>

      <Card className="premium-card">
        <SectionHeader title="Eventos de pago" description="Eventos/recibos registrados por API. No llama checkout real." />
        {pagos.length === 0 ? (
          <EmptyState
            variant="controlled"
            titulo="Conciliación en espera"
            mensaje="No hay eventos de pago confirmados. La consola mantiene el espacio de conciliación sin abrir Wompi ni ejecutar cobros reales."
          />
        ) : null}
        <ul style={listStyle} className="mt-4">
          {pagos.map((pago) => (
            <li key={pago.id ?? pago.transactionId ?? pago.reference} style={itemStyle}>
              <div style={lineStyle}>
                <strong>{pago.transactionId ?? pago.id ?? 'pago'}</strong>
                <Badge estado={pago.status}>{pago.status ?? 'sin_estado'}</Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span>Referencia {text(pago.reference)}</span>
                <span>Monto {typeof pago.amountInCents === 'number' ? `${pago.amountInCents / 100} ${pago.currency ?? 'COP'}` : 'Sin monto'}</span>
                <span>Suscripción {text(pago.subscriptionId)}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
