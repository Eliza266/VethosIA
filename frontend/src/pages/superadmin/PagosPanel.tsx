import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, EmptyState, SectionHeader, Button, useToast } from '../../components/ui/Primitives';
import type { SuperAdminDataset } from './types';
import { formatFechaRegistro, parseFirebaseDate, resolveOwnerName, resolvePlanName } from './utils';
import { TablePaginationControls, useResponsivePagination } from './TablePagination';
import { registrarPagoManual, type CicloFacturacion, type Plan } from '../../features/saas/api';
import { getErrorMessage } from '../../lib/errors';

// Fase 1: el cobro real lo gestiona Eliza manualmente por WhatsApp (sin pasarela de
// pago activa). Esta tabla reemplaza la vista de estado de Wompi -- que no aporta nada
// mientras no se use -- por lo que sí hace falta operativamente: quién debe pagar, desde
// cuándo, hasta cuándo, cuánto, y si ya pagó o no. "Registrar pago" deja constancia de
// cuándo y por qué medio le pagaron, y opcionalmente extiende la vigencia del plan.
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

const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Bancolombia', 'Otro'];

const formatCOP = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

function valorAPagarCOP(plan: Plan | undefined, ciclo: CicloFacturacion): number | null {
  if (!plan) return null;
  return ciclo === 'anual' ? plan.precioAnualCOP : plan.precioMensualCOP;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

export const PagosPanel: React.FC<{ dataset: SuperAdminDataset }> = ({ dataset }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filaAbierta, setFilaAbierta] = useState<string | null>(null);
  const [medioPago, setMedioPago] = useState(MEDIOS_PAGO[0]);
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [montoPago, setMontoPago] = useState('');
  const [extenderCiclo, setExtenderCiclo] = useState<CicloFacturacion | ''>('mensual');

  const registrarPago = useMutation({
    mutationFn: (input: { id: string; amountInCents: number }) =>
      registrarPagoManual(input.id, {
        amountInCents: input.amountInCents,
        medioPago,
        fechaPago: fechaPago || undefined,
        extenderCiclo: extenderCiclo || undefined,
      }),
    onSuccess: () => {
      toast('Pago registrado.', 'success');
      setFilaAbierta(null);
      qc.invalidateQueries({ queryKey: ['backoffice-suscripciones'] });
      qc.invalidateQueries({ queryKey: ['backoffice-auditoria'] });
    },
    onError: (err) => {
      toast(getErrorMessage(err, 'No se pudo registrar el pago.'), 'error');
    },
  });

  const filas = dataset.suscripciones.map((s) => {
    const estado = String(s.estado ?? s.status ?? 'trial_activa');
    const cobro = estadoCobroDe(estado);
    const inicio = parseFirebaseDate(s.creadoEn ?? s.createdAt);
    const fin = parseFirebaseDate(s.vigenteHasta ?? s.trialHasta);
    const planId = typeof s.planId === 'string' ? s.planId : undefined;
    const plan = dataset.planes.find((p) => p.id === planId);
    const ciclo: CicloFacturacion = s.ciclo === 'anual' ? 'anual' : 'mensual';
    const valor = valorAPagarCOP(plan, ciclo);
    return {
      id: String(s.id ?? resolveOwnerName(s, dataset)),
      cuenta: resolveOwnerName(s, dataset),
      plan: resolvePlanName(s.planId, dataset.planes),
      inicio,
      fin,
      estado,
      cobro,
      valor,
    };
  });

  // Los que necesitan cobro primero: es lo que Eliza va a revisar cada vez que entra aca.
  filas.sort((a, b) => Number(b.cobro.cobrar) - Number(a.cobro.cobrar));

  const { page, setPage, pageSize, totalPages, totalItems, pagedItems } = useResponsivePagination(filas);

  const abrirFormulario = (filaId: string, valorSugerido: number | null) => {
    setFilaAbierta(filaId);
    setMedioPago(MEDIOS_PAGO[0]);
    setFechaPago(hoyISO());
    setMontoPago(valorSugerido !== null ? String(valorSugerido) : '');
    setExtenderCiclo('mensual');
  };

  const confirmarPago = (filaId: string) => {
    const monto = Number(montoPago);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast('Ingresa un valor de pago válido.', 'error');
      return;
    }
    registrarPago.mutate({ id: filaId, amountInCents: Math.round(monto * 100) });
  };

  return (
    <div className="grid gap-5" data-testid="superadmin-pagos-panel">
      <Card className="premium-card">
        <SectionHeader
          title="Cobro manual"
          description="Fase 1: el pago se gestiona por WhatsApp, no por pasarela. Registra aquí cuándo te pagaron y por qué medio."
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
                    <th className="py-3 px-3">Valor a pagar</th>
                    <th className="py-3 px-3">¿Hay que cobrar?</th>
                    <th className="py-3 px-3">Pago</th>
                    <th className="py-3 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {pagedItems.map((fila) => (
                    <React.Fragment key={fila.id}>
                      <tr className="hover:bg-[var(--surface-2)] transition-colors">
                        <td className="py-3 px-3 font-bold text-[var(--text)]">{fila.cuenta}</td>
                        <td className="py-3 px-3 text-[var(--text)]">{fila.plan}</td>
                        <td className="py-3 px-3 font-mono text-[var(--muted)]">
                          {fila.inicio ? formatFechaRegistro(fila.inicio) : 'Sin fecha'}
                        </td>
                        <td className="py-3 px-3 font-mono text-[var(--muted)]">
                          {fila.fin ? formatFechaRegistro(fila.fin) : 'Sin vencimiento'}
                        </td>
                        <td className="py-3 px-3 font-mono text-[var(--text)]">
                          {fila.valor !== null ? formatCOP(fila.valor) : '—'}
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
                        <td className="py-3 px-3 text-right">
                          <Button
                            variant="ghost"
                            onClick={() =>
                              filaAbierta === fila.id ? setFilaAbierta(null) : abrirFormulario(fila.id, fila.valor)
                            }
                          >
                            {filaAbierta === fila.id ? 'Cancelar' : 'Registrar pago'}
                          </Button>
                        </td>
                      </tr>
                      {filaAbierta === fila.id && (
                        <tr className="bg-[var(--surface-2)]">
                          <td colSpan={8} className="p-4">
                            <div className="flex flex-wrap items-end gap-3">
                              <label className="grid gap-1">
                                <span className="text-[11px] font-bold text-[var(--muted)]">Fecha de pago</span>
                                <input
                                  type="date"
                                  value={fechaPago}
                                  onChange={(e) => setFechaPago(e.target.value)}
                                  className="min-h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] outline-none focus:border-accent"
                                />
                              </label>
                              <label className="grid gap-1">
                                <span className="text-[11px] font-bold text-[var(--muted)]">Medio de pago</span>
                                <select
                                  value={medioPago}
                                  onChange={(e) => setMedioPago(e.target.value)}
                                  className="min-h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] outline-none focus:border-accent"
                                >
                                  {MEDIOS_PAGO.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="grid gap-1">
                                <span className="text-[11px] font-bold text-[var(--muted)]">Valor pagado (COP)</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={montoPago}
                                  onChange={(e) => setMontoPago(e.target.value)}
                                  className="min-h-9 w-32 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] outline-none focus:border-accent"
                                />
                              </label>
                              <label className="grid gap-1">
                                <span className="text-[11px] font-bold text-[var(--muted)]">Extiende la vigencia</span>
                                <select
                                  value={extenderCiclo}
                                  onChange={(e) => setExtenderCiclo(e.target.value as CicloFacturacion | '')}
                                  className="min-h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[var(--text)] outline-none focus:border-accent"
                                >
                                  <option value="mensual">1 mes</option>
                                  <option value="anual">1 año</option>
                                  <option value="">No, solo dejar constancia</option>
                                </select>
                              </label>
                              <Button
                                onClick={() => confirmarPago(fila.id)}
                                disabled={registrarPago.isPending}
                              >
                                {registrarPago.isPending ? 'Guardando...' : 'Confirmar pago'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
