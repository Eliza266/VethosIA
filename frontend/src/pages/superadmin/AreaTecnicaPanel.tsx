import React from 'react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { SolicitudTecnica } from '../../features/tenant/api';
import type { SuperAdminActionState } from './types';
import { itemStyle, lineStyle, listStyle } from './utils';

export const AreaTecnicaPanel: React.FC<{
  solicitudes: SolicitudTecnica[];
  actionState: SuperAdminActionState;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}> = ({ solicitudes, actionState, onApprove, onReject }) => (
  <Card className="premium-card">
    <SectionHeader
      title="Área técnica"
      description="Solicitudes de vinculación con conflicto de organización, sede o plan."
    />
    {solicitudes.length === 0 ? (
      <EmptyState
        variant="controlled"
        titulo="Sin solicitudes técnicas"
        mensaje="No hay decisiones pendientes. La mesa técnica queda lista para resolver conflictos de organización, sede o plan."
      />
    ) : null}
    <ul style={listStyle} className="mt-4">
      {solicitudes.map((solicitud) => (
        <li key={solicitud.id} style={itemStyle}>
          <div style={lineStyle}>
            <span><strong>{solicitud.emailInvitado}</strong> - {solicitud.roleSolicitado ?? solicitud.rolSolicitado}</span>
            <Badge estado={solicitud.estado === 'pendiente' ? 'pendiente' : solicitud.estado}>{solicitud.estado}</Badge>
          </div>
          <span className="text-sm text-[var(--muted)]">
            {solicitud.conflicto ?? solicitud.motivo ?? 'Solicitud pendiente de decisión técnica.'}
          </span>
          {solicitud.estado === 'pendiente' ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onApprove(solicitud.id)} disabled={actionState.solicitudTecnica}>Aprobar vinculación</Button>
              <Button variant="ghost" onClick={() => onReject(solicitud.id)} disabled={actionState.solicitudTecnica}>Rechazar</Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  </Card>
);
