import React from 'react';
import { Badge, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { PagoLigero } from '../../features/saas/api';
import type { SystemConfigPublicView } from '../../features/plataforma/api';
import { text } from './utils';
import { TablePaginationControls, useResponsivePagination } from './TablePagination';

export const PagosPanel: React.FC<{
  pagos: PagoLigero[];
  systemConfig?: SystemConfigPublicView;
}> = ({ pagos, systemConfig }) => {
  const wompi = systemConfig?.integrations.wompi;

  // Paginación responsiva universal
  const { page, setPage, pageSize, totalPages, totalItems, pagedItems } = useResponsivePagination(pagos);

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
        <SectionHeader title="Eventos de pago" description="Eventos/recibos registrados por API en tabla con paginación adaptativa." />
        {pagos.length === 0 ? (
          <EmptyState
            variant="controlled"
            titulo="Conciliación en espera"
            mensaje="No hay eventos de pago confirmados. La consola mantiene el espacio de conciliación sin abrir Wompi ni ejecutar cobros reales."
          />
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Transacción / ID</th>
                    <th className="py-3 px-3">Referencia</th>
                    <th className="py-3 px-3">Monto</th>
                    <th className="py-3 px-3">Suscripción Target</th>
                    <th className="py-3 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {pagedItems.map((pago) => (
                    <tr key={pago.id ?? pago.transactionId ?? pago.reference} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="py-3 px-3 font-bold text-[var(--text)]">
                        {pago.transactionId ?? pago.id ?? 'pago'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--text)]">
                        {text(pago.reference)}
                      </td>
                      <td className="py-3 px-3 font-bold text-[var(--text)]">
                        {typeof pago.amountInCents === 'number' ? `${pago.amountInCents / 100} ${pago.currency ?? 'COP'}` : 'Sin monto'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--muted)]">
                        {text(pago.subscriptionId)}
                      </td>
                      <td className="py-3 px-3">
                        <Badge estado={pago.status}>{pago.status ?? 'sin_estado'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePaginationControls
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
};
