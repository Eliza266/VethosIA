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
      <section aria-label="Crear plan" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <input aria-label="Nombre del plan" placeholder="Nombre" value={draft.nombre} onChange={(e) => setDraft((c) => ({ ...c, nombre: e.target.value }))} style={inputStyle} />
        <input aria-label="Precio mensual" type="number" value={draft.precioMensualCOP} onChange={(e) => setDraft((c) => ({ ...c, precioMensualCOP: Number(e.target.value) }))} style={inputStyle} />
        <input aria-label="Precio anual" type="number" value={draft.precioAnualCOP} onChange={(e) => setDraft((c) => ({ ...c, precioAnualCOP: Number(e.target.value) }))} style={inputStyle} />
        <input aria-label="Asientos máximos" type="number" value={draft.asientosMax} onChange={(e) => setDraft((c) => ({ ...c, asientosMax: Number(e.target.value) }))} style={inputStyle} />
        <input aria-label="Limite historias por mes" type="number" value={draft.limiteHistoriasMes} onChange={(e) => setDraft((c) => ({ ...c, limiteHistoriasMes: Number(e.target.value) }))} style={inputStyle} />
        <Button onClick={onCreate} disabled={!draft.nombre.trim() || actionState.crearPlan}>Crear plan</Button>
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
              <span>${plan.precioMensualCOP}/mes</span>
              <span>${plan.precioAnualCOP}/año</span>
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
