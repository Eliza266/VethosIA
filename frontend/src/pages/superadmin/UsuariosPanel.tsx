import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, SectionHeader, useToast } from '../../components/ui/Primitives';
import type { BackofficeMiembro } from '../../features/backoffice/api';
import type { SuperAdminActionState, SuperAdminDataset } from './types';
import { esCuentaActual, estadoMiembro, inputStyle, itemStyle, lineStyle, listStyle, text } from './utils';
import { crearInvitacion, crearInvitacionV2 } from '../../features/tenant/api';
import type { CrearInvitacionV2Dto } from '../../features/tenant/api';

export const UsuariosPanel: React.FC<{
  data: SuperAdminDataset;
  actionState: SuperAdminActionState;
  onToggleBloqueo: (miembro: BackofficeMiembro) => void;
}> = ({ data, actionState, onToggleBloqueo }) => {
  const { toast } = useToast();

  // Filtros
  const [rolFiltro, setRolFiltro] = useState('');
  const [scopeFiltro, setScopeFiltro] = useState('');

  // Formulario de Invitación
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin_entidad' | 'admin_veterinaria' | 'veterinario'>('veterinario');
  const [entidadId, setEntidadId] = useState('');
  const [veterinariaId, setVeterinariaId] = useState('');
  const [loading, setLoading] = useState(false);

  const filtrados = useMemo(
    () =>
      data.miembros.filter((miembro) => {
        const rol = miembro.role ?? miembro.rol;
        const scope = `${miembro.entidadId ?? ''} ${miembro.veterinariaId ?? ''} ${miembro.accountId ?? ''} ${miembro.orgId ?? ''}`.toLowerCase();
        return (!rolFiltro || rol === rolFiltro) && (!scopeFiltro || scope.includes(scopeFiltro.toLowerCase()));
      }),
    [data.miembros, rolFiltro, scopeFiltro],
  );

  // Filtrar veterinarias según la entidad seleccionada
  const veterinariasFiltradas = useMemo(() => {
    if (!entidadId) return [];
    return data.veterinarias.filter((v) => v.entidadId === entidadId);
  }, [data.veterinarias, entidadId]);

  // Al cambiar la entidad en el formulario, resetear veterinaria seleccionada
  const handleEntidadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setEntidadId(val);
    setVeterinariaId('');
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast('Por favor, introduce un correo electrónico válido.', 'error');
      return;
    }
    if (!entidadId) {
      toast('Por favor, selecciona una entidad.', 'error');
      return;
    }
    if (role === 'admin_veterinaria' && !veterinariaId) {
      toast('Por favor, selecciona una sede para el Administrador de Veterinaria.', 'error');
      return;
    }

    setLoading(true);
    try {
      if (role === 'admin_entidad') {
        await crearInvitacion(entidadId, email.trim(), 'admin');
        toast(`Invitación enviada con éxito a ${email.trim()}`, 'success');
      } else {
        const selectedVet = data.veterinarias.find((v) => v.id === veterinariaId);

        const dto: CrearInvitacionV2Dto = {
          email: email.trim(),
          role: role as 'admin_veterinaria' | 'veterinario',
          entidadId: entidadId,
          veterinariaId: veterinariaId || undefined,
          accountId: veterinariaId || undefined,
          accountType: 'veterinaria',
          planOwnerType: selectedVet?.planOwnerType || 'entidad',
          planOwnerId: selectedVet?.planOwnerId || entidadId,
          vinculoTipo: role === 'admin_veterinaria' ? 'owner' : 'staff',
        };

        if (role === 'veterinario' && !veterinariaId) {
          // Freelance directo de entidad
          dto.accountType = 'entidad';
          dto.accountId = entidadId;
          dto.planOwnerType = 'entidad';
          dto.planOwnerId = entidadId;
          dto.vinculoTipo = 'freelance';
        }

        await crearInvitacionV2(dto);
        toast(`Invitación V2 enviada con éxito a ${email.trim()}`, 'success');
      }
      setEmail('');
      setVeterinariaId('');
    } catch (err) {
      let errorMsg = 'Error desconocido';
      if (err instanceof Error) {
        errorMsg = err.message;
      }
      const axiosError = err as { response?: { data?: { message?: string } } };
      if (axiosError?.response?.data?.message) {
        errorMsg = axiosError.response.data.message;
      }
      toast(`Error al enviar la invitación: ${errorMsg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3" data-testid="superadmin-usuarios-panel">
      {/* Columna Izquierda: Formulario de Invitación */}
      <Card className="premium-card md:col-span-1 flex flex-col gap-4 h-fit" style={{ minWidth: 0 }}>
        <SectionHeader
          title="Invitar usuario"
          description="Envía una invitación global con rol y scope específicos."
        />
        <form onSubmit={handleInvite} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Correo Electrónico</label>
            <input
              type="email"
              placeholder="ejemplo@vethosia.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={inputStyle}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Rol V2</label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as 'admin_entidad' | 'admin_veterinaria' | 'veterinario');
                setVeterinariaId('');
              }}
              disabled={loading}
              style={inputStyle}
            >
              <option value="veterinario">Veterinario</option>
              <option value="admin_veterinaria">Admin Veterinaria</option>
              <option value="admin_entidad">Admin Entidad</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Entidad Destino</label>
            <select
              value={entidadId}
              onChange={handleEntidadChange}
              disabled={loading}
              style={inputStyle}
              required
            >
              <option value="">-- Seleccionar Entidad --</option>
              {data.entidades.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.nombre}
                </option>
              ))}
            </select>
          </div>

          {role !== 'admin_entidad' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Sede / Veterinaria</label>
              <select
                value={veterinariaId}
                onChange={(e) => setVeterinariaId(e.target.value)}
                disabled={loading || !entidadId}
                style={inputStyle}
                required={role === 'admin_veterinaria'}
              >
                <option value="">
                  {role === 'veterinario' ? '-- Sin Sede (Freelance) --' : '-- Seleccionar Sede --'}
                </option>
                {veterinariasFiltradas.map((vet) => (
                  <option key={vet.id} value={vet.id}>
                    {vet.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? 'Enviando...' : 'Enviar Invitación'}
          </Button>
        </form>
      </Card>

      {/* Columna Derecha: Tabla/Lista de Miembros Existentes */}
      <Card className="premium-card md:col-span-2 flex flex-col gap-4" style={{ minWidth: 0 }}>
        <SectionHeader
          title="Usuarios y miembros"
          description="Miembros globales con rol, scope V2 y estado. No se exponen tokens ni secretos."
        />
        <div className="grid gap-3 md:grid-cols-2 mt-2">
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
    </div>
  );
};
