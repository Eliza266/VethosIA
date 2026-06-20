import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { BackofficeMiembro } from '../../features/backoffice/api';
import type { SuperAdminActionState, SuperAdminDataset } from './types';
import { esCuentaActual, estadoMiembro, inputStyle, itemStyle, lineStyle, listStyle, text } from './utils';

export const UsuariosPanel: React.FC<{
  data: SuperAdminDataset;
  actionState: SuperAdminActionState;
  onToggleBloqueo: (miembro: BackofficeMiembro) => void;
}> = ({ data, actionState, onToggleBloqueo }) => {
  const [rolFiltro, setRolFiltro] = useState('');
  const [scopeFiltro, setScopeFiltro] = useState('');

  const filtrados = useMemo(
    () =>
      data.miembros.filter((miembro) => {
        const rol = miembro.role ?? miembro.rol;
        const scope = `${miembro.entidadId ?? ''} ${miembro.veterinariaId ?? ''} ${miembro.accountId ?? ''} ${miembro.orgId ?? ''}`.toLowerCase();
        return (!rolFiltro || rol === rolFiltro) && (!scopeFiltro || scope.includes(scopeFiltro.toLowerCase()));
      }),
    [data.miembros, rolFiltro, scopeFiltro],
  );

  return (
    <Card className="premium-card" data-testid="superadmin-usuarios-panel">
      <SectionHeader
        title="Usuarios y miembros"
        description="Miembros globales con rol, scope V2 y estado. No se exponen tokens ni secretos."
      />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <select aria-label="Filtrar usuarios por rol" value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value)} style={inputStyle}>
          <option value="">Todos los roles</option>
          <option value="superadmin">superadmin</option>
          <option value="admin_entidad">admin_entidad</option>
          <option value="admin_veterinaria">admin_veterinaria</option>
          <option value="veterinario">veterinario</option>
          <option value="admin">admin legacy</option>
          <option value="vet">vet legacy</option>
        </select>
        <input aria-label="Filtrar usuarios por scope" placeholder="Buscar entidad, sede, cuenta u org" value={scopeFiltro} onChange={(e) => setScopeFiltro(e.target.value)} style={inputStyle} />
      </div>
      {filtrados.length === 0 ? (
        <EmptyState
          variant="controlled"
          titulo="Sin usuarios para el filtro"
          mensaje="Ajusta rol o scope para revisar miembros globales sin relajar permisos."
        />
      ) : null}
      <ul style={listStyle} className="mt-4">
        {filtrados.map((miembro) => {
          const actual = esCuentaActual(data.me, miembro);
          const bloqueado = miembro.bloqueado || miembro.estado === 'bloqueado';
          const nombre = miembro.email ?? miembro.uid;
          return (
            <li key={miembro.id} style={itemStyle}>
              <div style={lineStyle}>
                <div>
                  <strong>{nombre}</strong>
                  <div className="text-sm text-[var(--muted)]">
                    {(miembro.role ?? miembro.rol)} - {miembro.accountType ?? 'legacy'} - {text(miembro.accountId ?? miembro.orgId)}
                  </div>
                </div>
                <Badge estado={estadoMiembro(miembro)}>{estadoMiembro(miembro)}</Badge>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span>Entidad {text(miembro.entidadId)}</span>
                <span>Sede {text(miembro.veterinariaId)}</span>
                <span>Plan {text(miembro.planOwnerId)}</span>
                <span>Membership {text(miembro.membershipId ?? miembro.id)}</span>
              </div>
              <Button
                variant={bloqueado ? 'success' : 'danger'}
                aria-label={actual ? 'Cuenta actual sin accion' : `${bloqueado ? 'Activar' : 'Desactivar'} usuario ${nombre}`}
                onClick={() => onToggleBloqueo(miembro)}
                disabled={actual || actionState.cambiarBloqueo}
              >
                {actual ? 'Cuenta actual' : bloqueado ? 'Activar' : 'Desactivar'}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};
