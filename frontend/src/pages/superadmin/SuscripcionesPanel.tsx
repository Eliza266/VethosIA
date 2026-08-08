import React, { useMemo, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button, Card, EmptyState, SectionHeader, useToast } from '../../components/ui/Primitives';
import type { BackofficeConsumo } from '../../features/backoffice/api';
import type { SuperAdminDataset } from './types';
import {
  calcularTiempoTrialRestante,
  consumoLabel,
  formatFechaRegistro,
  inputStyle,
  resolveOwnerName,
  resolvePlanName,
  text,
} from './utils';
import { TablePaginationControls, useResponsivePagination } from './TablePagination';
import { asignarPlanSuscripcion, cambiarEstadoSuscripcion, extenderTrial } from '../../features/saas/api';

export const SuscripcionesPanel: React.FC<{
  suscripciones: Array<Record<string, unknown>>;
  consumos: BackofficeConsumo[];
  dataset?: SuperAdminDataset;
  onExtenderTrial?: (id: string, dias: number) => void;
  onCambiarEstado?: (id: string, estado: string) => void;
  onCambiarPlan?: (id: string, planId: string) => void;
}> = ({ suscripciones, consumos, dataset, onCambiarEstado, onCambiarPlan }) => {
  const { toast } = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [loadingPlan, setLoadingPlan] = useState<Record<string, boolean>>({});
  const [loadingEstado, setLoadingEstado] = useState<Record<string, boolean>>({});
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({});
  const [selectedEstados, setSelectedEstados] = useState<Record<string, string>>({});

  // Lista de planes comerciales disponibles incluyendo Trial 7 Días
  const planesDisponibles = [
    { id: 'trial_7_dias', nombre: '⏱️ Trial Gratuito (7 Días)', asientosMax: 3, limiteHistoriasMes: 50 },
    { id: '1X7sGaOwkqs8MVc95o25', nombre: '🏷️ Veterinario Individual', asientosMax: 1, limiteHistoriasMes: 150 },
    { id: 'TWoUuC2ZAjBE891a6cAL', nombre: '🏷️ Clínica Start', asientosMax: 3, limiteHistoriasMes: 400 },
    { id: 'yL18tVnIKjtvEnY0nWRx', nombre: '🏷️ Clínica Pro', asientosMax: 7, limiteHistoriasMes: 950 },
    { id: 'oq7uo8eBIgb3f7ZZ8RYc', nombre: '🏷️ Clínica Enterprise', asientosMax: 15, limiteHistoriasMes: 2000 },
  ];

  // Helper para buscar plan por ID o coincidencia parcial
  const findPlanObj = (targetId: string) => {
    return (
      planesDisponibles.find((p) => p.id === targetId) ||
      planesDisponibles.find((p) => p.nombre.toLowerCase().includes(targetId.toLowerCase())) ||
      planesDisponibles.find((p) => targetId.toLowerCase().includes(p.nombre.toLowerCase()))
    );
  };

  const handleGuardarPlan = async (subId: string) => {
    const newPlanId = selectedPlans[subId];
    if (!newPlanId) {
      toast('Selecciona un plan antes de guardar.', 'error');
      return;
    }

    const planObj = findPlanObj(newPlanId);
    if (!planObj) {
      toast('Plan seleccionado no válido.', 'error');
      return;
    }

    setLoadingPlan((prev) => ({ ...prev, [subId]: true }));
    try {
      // Un solo camino de escritura, via API: valida el plan contra la coleccion
      // 'planes' server-side, deja auditoria, y evita que el cliente reescriba
      // datos derivados (asientosMax, limiteHistoriasMes) el mismo que el backend.
      // 'trial_7_dias' es un valor especial del selector, no un plan real en
      // Firestore: usa el endpoint de extender-trial en vez de asignar-plan.
      if (planObj.id === 'trial_7_dias') {
        await extenderTrial(subId, 7);
      } else if (onCambiarPlan) {
        await onCambiarPlan(subId, planObj.id);
      } else {
        await asignarPlanSuscripcion(subId, planObj.id);
      }
      toast(`✅ Plan guardado con éxito: ${planObj.nombre}`, 'success');
    } catch (err) {
      toast('Error al guardar el plan en la base de datos.', 'error');
    } finally {
      setLoadingPlan((prev) => ({ ...prev, [subId]: false }));
    }
  };

  const handleCambiarEstado = async (subId: string, nuevoEstado: string) => {
    setSelectedEstados((prev) => ({ ...prev, [subId]: nuevoEstado }));
    setLoadingEstado((prev) => ({ ...prev, [subId]: true }));

    try {
      // 1. Escritura directa a Firestore
      const subDocRef = doc(db, 'suscripciones', subId);
      await setDoc(
        subDocRef,
        {
          estado: nuevoEstado,
          status: nuevoEstado,
          actualizadoEn: new Date().toISOString(),
        },
        { merge: true },
      );

      // 2. Notificar vía API Backend
      try {
        if (onCambiarEstado) {
          await onCambiarEstado(subId, nuevoEstado);
        } else {
          await cambiarEstadoSuscripcion(subId, nuevoEstado);
        }
      } catch (apiErr) {
        // Fallback OK
      }

      const estadoTexto = nuevoEstado === 'activa' || nuevoEstado === 'trial_activa' ? 'Activo' : 'Inactivo';
      toast(`✅ Estado de cuenta cambiado a: ${estadoTexto}`, 'success');
    } catch (err) {
      toast('Error al cambiar el estado en la base de datos.', 'error');
    } finally {
      setLoadingEstado((prev) => ({ ...prev, [subId]: false }));
    }
  };

  // Filtrado reactivo de suscripciones
  const suscripcionesFiltradas = useMemo(() => {
    return suscripciones.filter((s) => {
      const ownerName = resolveOwnerName(s, dataset).toLowerCase();
      const planName = resolvePlanName(s.planId, dataset?.planes ?? []).toLowerCase();
      const subId = String(s.id ?? '').toLowerCase();
      const planOwnerId = String(s.planOwnerId ?? '').toLowerCase();
      const estado = String(s.estado || s.status || '').toLowerCase();
      const query = busqueda.trim().toLowerCase();

      // Filtro de texto general
      const coincideTexto =
        !query ||
        ownerName.includes(query) ||
        planName.includes(query) ||
        subId.includes(query) ||
        planOwnerId.includes(query);

      if (!coincideTexto) return false;

      // Filtro por estado
      if (filtroEstado === 'todos') return true;
      if (filtroEstado === 'trial') return estado === 'trial_activa' || estado === 'trial';
      if (filtroEstado === 'activa') return estado === 'activa' || estado === 'pagada';
      if (filtroEstado === 'bloqueada') return estado === 'bloqueado_fin_trial' || estado === 'bloqueado' || estado === 'mora' || estado === 'desactivado';
      if (filtroEstado === 'vencida') return estado === 'vencida' || estado === 'expirada';
      return true;
    });
  }, [suscripciones, dataset, busqueda, filtroEstado]);

  // Paginación responsiva universal
  const { page, setPage, pageSize, totalPages, totalItems, pagedItems } = useResponsivePagination(suscripcionesFiltradas);

  return (
    <Card className="premium-card" data-testid="superadmin-suscripciones-panel">
      <SectionHeader
        title="Suscripciones y Pruebas Gratuitas (Trials)"
        description="Vista consolidada en tabla con filtros. Asigna manualmente el plan comercial (incluyendo Trial 7 Días) y cambia el estado a Activo o Inactivo."
      />

      {/* Controles de Filtro y Búsqueda */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre de clínica, usuario o plan..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={inputStyle}
          className="w-full"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          style={inputStyle}
          className="w-full"
        >
          <option value="todos">Todos los estados</option>
          <option value="trial">⏱️ Trial Activa</option>
          <option value="activa">💳 Plan Activo / Pagada</option>
          <option value="bloqueada">🚫 Bloqueada / Inactivo</option>
          <option value="vencida">⚠️ Vencida</option>
        </select>
        <div className="flex items-center justify-end text-xs text-[var(--muted)] font-bold">
          Total: {suscripcionesFiltradas.length} suscripciones
        </div>
      </div>

      {suscripcionesFiltradas.length === 0 ? (
        <EmptyState
          variant="controlled"
          titulo="Sin suscripciones para los filtros seleccionados"
          mensaje="Ajusta el texto de búsqueda o el filtro de estado para revisar las suscripciones activas."
        />
      ) : (
        <>
          {/* Vista de Tabla Estructurada */}
          <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">Cuenta / Propietario</th>
                  <th className="py-3 px-3">Asignar Plan Comercial</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Fecha Registro</th>
                  <th className="py-3 px-3">Trial / Restante</th>
                  <th className="py-3 px-3">Uso SOAP</th>
                  <th className="py-3 px-3">Estado de Cuenta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {pagedItems.map((suscripcion) => {
                  const subId = String(suscripcion.id);
                  const ownerName = resolveOwnerName(suscripcion, dataset);
                  const dbPlanId = String(suscripcion.planId ?? '');
                  const dbPlanNombre = String(suscripcion.planNombre ?? '');
                  const currentPlanObj = findPlanObj(dbPlanId) || findPlanObj(dbPlanNombre);
                  const currentSelectVal = selectedPlans[subId] ?? (currentPlanObj ? currentPlanObj.id : '');
                  const currentPlanName = resolvePlanName(suscripcion.planId, dataset?.planes ?? []);
                  const ownerConsumos = consumos.filter(
                    (c) =>
                      c.entidadId === String(suscripcion.planOwnerId) ||
                      c.veterinariaId === String(suscripcion.planOwnerId) ||
                      c.scopeId === String(suscripcion.planOwnerId) ||
                      c.scopeId === subId,
                  );
                  const fechaRegistroStr = formatFechaRegistro(suscripcion.creadoEn ?? suscripcion.createdAt);
                  const trialInfo = calcularTiempoTrialRestante(
                    suscripcion.trialHasta,
                    suscripcion.creadoEn ?? suscripcion.createdAt,
                    suscripcion.estado,
                  );
                  const estadoRaw = String(suscripcion.estado || suscripcion.status || 'trial_activa');
                  const currentEstadoVal = selectedEstados[subId] ?? (
                    estadoRaw === 'bloqueado_fin_trial' || estadoRaw === 'bloqueado' || estadoRaw === 'desactivado' || estadoRaw === 'mora'
                      ? 'bloqueado_fin_trial'
                      : 'activa'
                  );
                  const isUpdatingPlan = loadingPlan[subId];
                  const isUpdatingEstado = loadingEstado[subId];

                  return (
                    <tr key={subId} className="hover:bg-[var(--surface-2)] transition-colors">
                      <td className="py-3 px-3">
                        <strong className="text-sm font-bold text-[var(--text)] block">{ownerName}</strong>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Seleccionar plan para ${ownerName}`}
                            value={currentSelectVal}
                            disabled={isUpdatingPlan}
                            onChange={(e) => setSelectedPlans((prev) => ({ ...prev, [subId]: e.target.value }))}
                            className="text-xs p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] font-bold min-w-[160px]"
                          >
                            <option value="">-- Seleccionar Plan --</option>
                            {planesDisponibles.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.nombre}
                              </option>
                            ))}
                          </select>

                          <Button
                            variant="primary"
                            aria-label={`Guardar plan para ${ownerName}`}
                            disabled={isUpdatingPlan || !currentSelectVal}
                            onClick={() => handleGuardarPlan(subId)}
                            className="text-xs py-1.5 px-3 whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm"
                          >
                            {isUpdatingPlan ? 'Guardando...' : '💾 Guardar Plan'}
                          </Button>
                        </div>
                        <span className="text-[10px] text-[var(--muted)] font-medium block mt-1">
                          Actual en DB: <strong>{currentPlanObj?.nombre ?? currentPlanName}</strong>
                        </span>
                      </td>
                      <td className="py-3 px-3 capitalize text-[var(--muted)] font-medium">
                        {text(suscripcion.planOwnerType, 'veterinaria')}
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--text)] whitespace-nowrap">
                        📅 {fechaRegistroStr}
                      </td>
                      <td className="py-3 px-3">
                        {trialInfo.esTrial ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold text-[11px] whitespace-nowrap ${
                              trialInfo.expirado
                                ? 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20'
                                : trialInfo.dias <= 1
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20'
                            }`}
                          >
                            {trialInfo.badgeTexto}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                            💳 Plan de Pago
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[var(--text)] whitespace-nowrap">
                        {consumoLabel(ownerConsumos)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Cambiar estado de cuenta para ${ownerName}`}
                            value={currentEstadoVal}
                            disabled={isUpdatingEstado}
                            onChange={(e) => handleCambiarEstado(subId, e.target.value)}
                            className={`text-xs p-1.5 rounded-lg border font-bold ${
                              currentEstadoVal === 'activa' || currentEstadoVal === 'trial_activa'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30'
                            }`}
                          >
                            <option value="activa">🟢 Activo</option>
                            <option value="bloqueado_fin_trial">🔴 Inactivo (Bloqueado)</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Controles de Paginación Universal */}
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
  );
};
