import React from 'react';
import { Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { SuperAdminDataset } from './types';
import { formatFechaRegistro, parseFirebaseDate, resolveOwnerName, resolvePlanName } from './utils';
import { TablePaginationControls, useResponsivePagination } from './TablePagination';

// Fase 1: el cobro real lo gestiona Eliza manualmente por WhatsApp (sin pasarela de
// pago activa). Esta tabla reemplaza la vista de estado de Wompi -- que no aporta nada
// mientras no se use -- por lo que sí hace falta operativamente: quién debe pagar, desde
// cuándo, hasta cuándo, y si ya pagó o no.
type EstadoCobro = { pago: 'al_dia' | 'pendiente' | 'trial'; cobrar: boolean };

function estadoCobroDe(estado: string): EstadoCobro {
  if (estado === 'activa' || estado === 'por_vencer') {
    return { pago: 'al_dia', cobrar: estado === 'por_vencer' };
  }
  if (estado === 'trial_activa') {
    return { pago: 'trial', cobrar: false };
  }
  // vencida, bloqueada_mora, bloqueado_fin_trial, desactivado, cancelada
  return { pago: 'pendiente', cobrar: estado !== 'desactivado' && estado !== 'cancelada' };
}

const PAGO_BADGE: Record<EstadoCobro['pago'], string> = {
  al_dia: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
  pendiente: 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20',
  trial: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20',
};

const PAGO_LABEL: Record<EstadoCobro['pago'], string> = {
  al_dia: 'Pagó',
  pendiente: 'No pagó',
  trial: 'En prueba',
};

export const PagosPanel: React.FC<{ dataset: SuperAdminDataset }> = ({ dataset }) => {
  const filas = dataset.suscripciones.map((s) => {
    const estado = String(s.estado ?? s.status ?? 'trial_activa');
    const cobro = estadoCobroDe(estado);
    const inicio = parseFirebaseDate(s.creadoEn ?? s.createdAt);
    const fin = parseFirebaseDate(s.vigenteHasta ?? s.trialHasta);
    return {
      id: String(s.id ?? resolveOwnerName(s, dataset)),
      cuenta: resolveOwnerName(s, dataset),
      plan: resolvePlanName(s.planId, dataset.planes),
      inicio,
      fin,
      estado,
      cobro,
    };
  });

  // Los que necesitan cobro primero: es lo que Eliza va a revisar cada vez que entra aca.
  filas.sort((a, b) => Number(b.cobro.cobrar) - Number(a.cobro.cobrar));

  const { page, setPage, pageSize, totalPages, totalItems, pagedItems } = useResponsivePagination(filas);

  return (
    <div className="grid gap-5" data-testid="superadmin-pagos-panel">
      <Card className="premium-card">
        <SectionHeader
          title="Cobro manual"
          description="Fase 1: el pago se gestiona por WhatsApp, no por pasarela. Esta tabla es para saber a quién cobrarle y desde/hasta cuándo va su plan."
        />
        {filas.length === 0 ? (
          <EmptyState
            variant="controlled"
            titulo="Sin cuentas todavía"
            mensaje="En cuanto haya registros o suscripciones, aparecen aquí."
          />
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Cuenta</th>
                    <th className="py-3 px-3">Plan</th>
                    <th className="py-3 px-3">Inicio</th>
                    <th className="py-3 px-3">Vence</th>
                    <th className="py-3 px-3">¿Hay que cobrar?</th>
                    <th className="py-3 px-3">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {pagedItems.map((fila) => (
                    <tr key={fila.id} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="py-3 px-3 font-bold text-[var(--text)]">{fila.cuenta}</td>
                      <td className="py-3 px-3 text-[var(--text)]">{fila.plan}</td>
                      <td className="py-3 px-3 font-mono text-[var(--muted)]">
                        {fila.inicio ? formatFechaRegistro(fila.inicio) : 'Sin fecha'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--muted)]">
                        {fila.fin ? formatFechaRegistro(fila.fin) : 'Sin vencimiento'}
                      </td>
                      <td className="py-3 px-3">
                        {fila.cobro.cobrar ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 font-bold text-amber-700 dark:text-amber-400">
                            Sí, cobrar
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">No todavía</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${PAGO_BADGE[fila.cobro.pago]}`}>
                          {PAGO_LABEL[fila.cobro.pago]}
                        </span>
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
