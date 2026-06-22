import React from 'react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { Plan } from '../../features/saas/api';
import type { SuperAdminActionState } from './types';
import { inputStyle, itemStyle, lineStyle, listStyle } from './utils';

export const PlanesPanel: React.FC<{
  planes: Plan[];
  draft: Omit<Plan, 'id'>;
  setDraft: React.Dispatch<React.SetStateAction<Omit<Plan, 'id'>>>;
  onCreate: () => void;
  actionState: SuperAdminActionState;
}> = ({ planes, draft, setDraft, onCreate, actionState }) => (
  <div className="grid gap-5" data-testid="superadmin-planes-panel">
    <Card className="premium-card">
      <SectionHeader
        title="Planes"
        description="Catálogo comercial controlado. Define reglas comerciales; no ejecuta cobros ni checkout por sí solo."
      />
      <section aria-label="Crear plan" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
          <span>Nombre del plan</span>
          <input aria-label="Nombre del plan" placeholder="Ej. Hospital" value={draft.nombre} onChange={(e) => setDraft((c) => ({ ...c, nombre: e.target.value }))} style={inputStyle} />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
          <span>Tipo de cuenta</span>
          <select aria-label="Tipo de cuenta" value={draft.tipo} onChange={(e) => setDraft((c) => ({ ...c, tipo: e.target.value as Plan['tipo'] }))} style={inputStyle}>
            <option value="individual">Veterinario individual</option>
            <option value="veterinaria">Veterinaria / clínica</option>
            <option value="entidad">Entidad</option>
            <option value="ambos">Ambos</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
          <span>Precio mensual (COP)</span>
          <input aria-label="Precio mensual" type="number" min={0} value={draft.precioMensualCOP} onChange={(e) => setDraft((c) => ({ ...c, precioMensualCOP: Number(e.target.value) }))} style={inputStyle} />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
          <span>Precio anual (COP)</span>
          <input aria-label="Precio anual" type="number" min={0} value={draft.precioAnualCOP} onChange={(e) => setDraft((c) => ({ ...c, precioAnualCOP: Number(e.target.value) }))} style={inputStyle} />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
          <span>Asientos (veterinaria/entidad)</span>
          <input aria-label="Asientos máximos" type="number" min={1} value={draft.asientosMax} onChange={(e) => setDraft((c) => ({ ...c, asientosMax: Number(e.target.value) }))} style={inputStyle} />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
          <span>Límite SOAP por vet / mes</span>
          <input aria-label="Limite historias por mes" type="number" min={0} value={draft.limiteHistoriasMes} onChange={(e) => setDraft((c) => ({ ...c, limiteHistoriasMes: Number(e.target.value) }))} style={inputStyle} />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
          <span>Historias gratis (trial)</span>
          <input aria-label="Historias gratis trial" type="number" min={0} value={draft.historiasGratisTrial} onChange={(e) => setDraft((c) => ({ ...c, historiasGratisTrial: Number(e.target.value) }))} style={inputStyle} />
        </label>
        <div className="flex items-end">
          <Button onClick={onCreate} disabled={!draft.nombre.trim() || actionState.crearPlan}>Crear plan</Button>
        </div>
      </section>
      <p className="mt-3 text-sm text-[var(--muted)]">Wompi real permanece server-side y no se activa desde este formulario.</p>
    </Card>
    <Card className="premium-card">
      <SectionHeader title="Catálogo de planes" description="Planes activos e inactivos visibles para soporte plataforma." />
      {planes.length === 0 ? (
        <EmptyState
          variant="controlled"
          titulo="Catálogo listo para activar"
          mensaje="Aún no hay planes publicados. El módulo queda preparado para cargar límites, asientos y precios cuando se apruebe la oferta comercial."
        />
      ) : null}
      <ul style={listStyle} className="mt-4">
        {planes.map((plan) => (
          <li key={plan.id} style={itemStyle}>
            <div style={lineStyle}>
              <strong>{plan.nombre}</strong>
              <Badge estado={plan.activo ? 'activa' : 'inactiva'}>{plan.activo ? 'activo' : 'inactivo'}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>${plan.precioMensualCOP.toLocaleString('es-CO')}/mes</span>
              <span>${plan.precioAnualCOP.toLocaleString('es-CO')}/año</span>
              <span>{plan.asientosMax} asientos</span>
              <span>{plan.limiteHistoriasMes} SOAP/mes</span>
              <span>{plan.historiasGratisTrial} trial</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  </div>
);
