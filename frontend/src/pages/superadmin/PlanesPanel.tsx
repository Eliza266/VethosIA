import React, { useState } from 'react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { Plan } from '../../features/saas/api';
import type { SuperAdminActionState } from './types';
import { inputStyle, itemStyle, lineStyle, listStyle } from './utils';
import { TablePaginationControls, useResponsivePagination } from './TablePagination';

export const PlanesPanel: React.FC<{
  planes: Plan[];
  draft: Omit<Plan, 'id'>;
  setDraft: React.Dispatch<React.SetStateAction<Omit<Plan, 'id'>>>;
  onCreate: () => void;
  onEditPlan?: (id: string, input: Partial<Plan>) => void;
  onToggleActivoPlan?: (plan: Plan) => void;
  actionState: SuperAdminActionState;
}> = ({ planes, draft, setDraft, onCreate, onEditPlan, onToggleActivoPlan, actionState }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Plan>>({});

  // Paginación responsiva universal
  const { page, setPage, pageSize, totalPages, totalItems, pagedItems } = useResponsivePagination(planes);

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setEditDraft({
      nombre: plan.nombre,
      tipo: plan.tipo,
      precioMensualCOP: plan.precioMensualCOP,
      precioAnualCOP: plan.precioAnualCOP,
      precioMensualUSD: plan.precioMensualUSD ?? 0,
      precioAnualUSD: plan.precioAnualUSD ?? 0,
      asientosMax: plan.asientosMax,
      limiteHistoriasMes: plan.limiteHistoriasMes,
      historiasGratisTrial: plan.historiasGratisTrial,
      activo: plan.activo,
    });
  };

  const handleSaveEdit = () => {
    if (!editingId || !onEditPlan) return;
    onEditPlan(editingId, editDraft);
    setEditingId(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.nombre.trim()) return;
    onCreate();
    setShowCreateModal(false);
  };

  return (
    <div className="grid gap-5" data-testid="superadmin-planes-panel">
      {/* Lista del Catálogo de Planes */}
      <Card className="premium-card">
        <SectionHeader
          title="Catálogo de planes"
          description="Planes activos e inactivos del SaaS. Como Super Admin puedes editar cualquier valor o inhabilitar/reactivar un plan."
          action={
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              ➕ Crear Nuevo Plan
            </Button>
          }
        />

        {planes.length === 0 ? (
          <EmptyState
            variant="controlled"
            titulo="Catálogo listo para activar"
            mensaje="Aún no hay planes publicados. Haz clic en 'Crear Nuevo Plan' para agregar el primer plan."
          />
        ) : (
          <>
            <ul style={listStyle} className="mt-4">
              {pagedItems.map((plan) => {
                const isEditing = editingId === plan.id;
                return (
                  <li key={plan.id} style={itemStyle}>
                    <div style={lineStyle}>
                      <strong className="text-base text-[var(--text)]">{plan.nombre}</strong>
                      <Badge estado={plan.activo ? 'activa' : 'inactiva'}>{plan.activo ? 'activo' : 'inactivo'}</Badge>
                    </div>

                    {isEditing ? (
                      /* Panel de Edición Inline */
                      <div className="p-3 my-2 rounded-xl border border-[var(--accent)] bg-[var(--surface-2)] grid gap-3 md:grid-cols-3">
                        <label className="grid gap-1 text-xs font-bold text-[var(--muted)]">
                          <span>Nombre</span>
                          <input
                            value={editDraft.nombre ?? ''}
                            onChange={(e) => setEditDraft((c) => ({ ...c, nombre: e.target.value }))}
                            style={inputStyle}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-bold text-[var(--muted)]">
                          <span>Precio Mensual COP</span>
                          <input
                            type="number"
                            min={0}
                            value={editDraft.precioMensualCOP ?? 0}
                            onChange={(e) => setEditDraft((c) => ({ ...c, precioMensualCOP: Number(e.target.value) }))}
                            style={inputStyle}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-bold text-[var(--muted)]">
                          <span>Precio Anual COP</span>
                          <input
                            type="number"
                            min={0}
                            value={editDraft.precioAnualCOP ?? 0}
                            onChange={(e) => setEditDraft((c) => ({ ...c, precioAnualCOP: Number(e.target.value) }))}
                            style={inputStyle}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-bold text-[var(--muted)]">
                          <span>Asientos Máximos</span>
                          <input
                            type="number"
                            min={1}
                            value={editDraft.asientosMax ?? 1}
                            onChange={(e) => setEditDraft((c) => ({ ...c, asientosMax: Number(e.target.value) }))}
                            style={inputStyle}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-bold text-[var(--muted)]">
                          <span>Límite SOAP / mes</span>
                          <input
                            type="number"
                            min={0}
                            value={editDraft.limiteHistoriasMes ?? 0}
                            onChange={(e) => setEditDraft((c) => ({ ...c, limiteHistoriasMes: Number(e.target.value) }))}
                            style={inputStyle}
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-bold text-[var(--muted)]">
                          <span>Historias Trial</span>
                          <input
                            type="number"
                            min={0}
                            value={editDraft.historiasGratisTrial ?? 0}
                            onChange={(e) => setEditDraft((c) => ({ ...c, historiasGratisTrial: Number(e.target.value) }))}
                            style={inputStyle}
                          />
                        </label>
                        <div className="md:col-span-3 flex gap-2 justify-end mt-2">
                          <Button variant="ghost" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                          <Button variant="primary" onClick={handleSaveEdit}>
                            Guardar Cambios
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Vista normal del plan */
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span>${plan.precioMensualCOP.toLocaleString('es-CO')} COP/mes</span>
                        <span>${plan.precioAnualCOP.toLocaleString('es-CO')} COP/año</span>
                        {Boolean(plan.precioMensualUSD) && (
                          <span>US${plan.precioMensualUSD!.toLocaleString('en-US')}/mes</span>
                        )}
                        {Boolean(plan.precioAnualUSD) && <span>US${plan.precioAnualUSD!.toLocaleString('en-US')}/año</span>}
                        <span>{plan.asientosMax} asientos</span>
                        <span>{plan.limiteHistoriasMes} SOAP/mes</span>
                        <span>{plan.historiasGratisTrial} trial</span>
                      </div>
                    )}

                    {!isEditing && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button variant="secondary" onClick={() => startEdit(plan)}>
                          ✏️ Editar Plan
                        </Button>
                        <Button
                          variant={plan.activo ? 'danger' : 'success'}
                          onClick={() => onToggleActivoPlan?.(plan)}
                        >
                          {plan.activo ? '🚫 Inhabilitar Plan' : '✅ Reactivar Plan'}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

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

      {/* Modal Popup para Crear Nuevo Plan */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text)]">➕ Crear Nuevo Plan Comercial</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[var(--muted)] hover:text-[var(--text)] text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Define las reglas comerciales del catálogo. El nuevo plan estará disponible de inmediato.
            </p>

            <form onSubmit={handleCreateSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mt-1">
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Nombre del plan</span>
                <input
                  aria-label="Nombre del plan"
                  placeholder="Ej. Clínica Enterprise"
                  value={draft.nombre}
                  onChange={(e) => setDraft((c) => ({ ...c, nombre: e.target.value }))}
                  style={inputStyle}
                  required
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Tipo de cuenta</span>
                <select
                  aria-label="Tipo de cuenta"
                  value={draft.tipo}
                  onChange={(e) => setDraft((c) => ({ ...c, tipo: e.target.value as Plan['tipo'] }))}
                  style={inputStyle}
                >
                  <option value="individual">Veterinario individual</option>
                  <option value="veterinaria">Veterinaria / clínica</option>
                  <option value="entidad">Entidad</option>
                  <option value="ambos">Ambos</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Precio mensual (COP)</span>
                <input
                  aria-label="Precio mensual"
                  type="number"
                  min={0}
                  value={draft.precioMensualCOP}
                  onChange={(e) => setDraft((c) => ({ ...c, precioMensualCOP: Number(e.target.value) }))}
                  style={inputStyle}
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Precio anual (COP)</span>
                <input
                  aria-label="Precio anual"
                  type="number"
                  min={0}
                  value={draft.precioAnualCOP}
                  onChange={(e) => setDraft((c) => ({ ...c, precioAnualCOP: Number(e.target.value) }))}
                  style={inputStyle}
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Precio mensual (USD)</span>
                <input
                  aria-label="Precio mensual USD"
                  type="number"
                  min={0}
                  value={draft.precioMensualUSD ?? 0}
                  onChange={(e) => setDraft((c) => ({ ...c, precioMensualUSD: Number(e.target.value) }))}
                  style={inputStyle}
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Precio anual (USD)</span>
                <input
                  aria-label="Precio anual USD"
                  type="number"
                  min={0}
                  value={draft.precioAnualUSD ?? 0}
                  onChange={(e) => setDraft((c) => ({ ...c, precioAnualUSD: Number(e.target.value) }))}
                  style={inputStyle}
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Asientos (veterinaria/entidad)</span>
                <input
                  aria-label="Asientos máximos"
                  type="number"
                  min={1}
                  value={draft.asientosMax}
                  onChange={(e) => setDraft((c) => ({ ...c, asientosMax: Number(e.target.value) }))}
                  style={inputStyle}
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Límite SOAP por vet / mes</span>
                <input
                  aria-label="Limite historias por mes"
                  type="number"
                  min={0}
                  value={draft.limiteHistoriasMes}
                  onChange={(e) => setDraft((c) => ({ ...c, limiteHistoriasMes: Number(e.target.value) }))}
                  style={inputStyle}
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Historias gratis (trial)</span>
                <input
                  aria-label="Historias gratis trial"
                  type="number"
                  min={0}
                  value={draft.historiasGratisTrial}
                  onChange={(e) => setDraft((c) => ({ ...c, historiasGratisTrial: Number(e.target.value) }))}
                  style={inputStyle}
                />
              </label>

              <div className="md:col-span-2 xl:col-span-3 flex gap-2 justify-end mt-4">
                <Button variant="ghost" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={!draft.nombre.trim() || actionState.crearPlan}>
                  Crear plan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
