import React from 'react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { BackofficeConsumo } from '../../features/backoffice/api';
import { consumoLabel, itemStyle, lineStyle, listStyle, planOwnerLabel, statusFromRecord, text } from './utils';

export const SuscripcionesPanel: React.FC<{
  suscripciones: Array<Record<string, unknown>>;
  consumos: BackofficeConsumo[];
}> = ({ suscripciones, consumos }) => (
  <Card className="premium-card" data-testid="superadmin-suscripciones-panel">
    <SectionHeader
      title="Suscripciones"
      description="Lectura global por plan owner. Acciones sensibles quedan deshabilitadas si no hay flujo seguro completo."
    />
    {suscripciones.length === 0 ? (
      <EmptyState
        variant="controlled"
        titulo="Sin suscripciones activas en revisión"
        mensaje="La consola está preparada para supervisar vigencia, consumo y plan owner cuando existan cuentas activas."
      />
    ) : null}
    <ul style={listStyle} className="mt-4">
      {suscripciones.map((suscripcion) => {
        const owner = planOwnerLabel(suscripcion);
        const ownerConsumos = consumos.filter(
          (c) => c.entidadId === owner || c.veterinariaId === owner || c.scopeId === owner,
        );
        return (
          <li key={String(suscripcion.id)} style={itemStyle}>
            <div style={lineStyle}>
              <strong>{owner}</strong>
              <Badge estado={statusFromRecord(suscripcion)}>{statusFromRecord(suscripcion)}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span>Plan {text(suscripcion.planId)}</span>
              <span>Owner {text(suscripcion.planOwnerType)}</span>
              <span>Vigencia {text(suscripcion.vigenteHasta ?? suscripcion.trialHasta)}</span>
              <span>Uso {consumoLabel(ownerConsumos)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" disabled>Extender trial requiere acción backend dedicada</Button>
              <Button variant="ghost" disabled>Bloqueo/reactivación controlado por flujo seguro</Button>
            </div>
          </li>
        );
      })}
    </ul>
  </Card>
);
