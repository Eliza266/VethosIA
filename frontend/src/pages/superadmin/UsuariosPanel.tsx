import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, SectionHeader, useToast } from '../../components/ui/Primitives';
import type { BackofficeMiembro } from '../../features/backoffice/api';
import type { SuperAdminActionState, SuperAdminDataset } from './types';
import {
  calcularTiempoTrialRestante,
  esCuentaActual,
  estadoMiembro,
  formatFechaRegistro,
  inputStyle,
} from './utils';
import { crearInvitacion, crearInvitacionV2 } from '../../features/tenant/api';
import type { CrearInvitacionV2Dto } from '../../features/tenant/api';
import { TablePaginationControls, useResponsivePagination } from './TablePagination';

export const UsuariosPanel: React.FC<{
  data: SuperAdminDataset;
  actionState: SuperAdminActionState;
  onToggleBloqueo: (miembro: BackofficeMiembro) => void;
}> = ({ data, actionState, onToggleBloqueo }) => {
  const { toast } = useToast();

  // Estado del Modal de Invitación
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [rolFiltro, setRolFiltro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  // Formulario de Invitación
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin_entidad' | 'admin_veterinaria' | 'veterinario'>('veterinario');
  const [entidadId, setEntidadId] = useState('');
  const [veterinariaId, setVeterinariaId] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper para resolver nombres legibles de sede y entidad
  const getSedeNombre = (miembro: BackofficeMiembro): string => {
    const vetId = miembro.veterinariaId || miembro.accountId;
    if (!vetId) return 'Sin Sede (Freelance)';
    const vet = data.veterinarias.find((v) => v.id === vetId || v.accountId === vetId);
    if (vet?.nombre) return vet.nombre;
    return 'Clínica Registrada';
  };

  const getEntidadNombre = (miembro: BackofficeMiembro): string => {
    const entId = miembro.entidadId || miembro.orgId;
    if (!entId) return 'Sin Entidad';
    const ent = data.entidades.find((e) => e.id === entId);
    if (ent?.nombre) return ent.nombre;
    const relEnt = data.relations.entidadById.get(entId);
    if (relEnt?.nombre) return relEnt.nombre;
    return 'Entidad Registrada';
  };

  // Filtrado reactivo de usuarios
  const filtrados = useMemo(
    () =>
      data.miembros.filter((miembro) => {
        const rol = miembro.role ?? miembro.rol ?? '';
        const userEmail = (miembro.email || '').toLowerCase();
        const userUid = (miembro.uid || '').toLowerCase();
        const sedeNombre = getSedeNombre(miembro).toLowerCase();
        const entidadNombre = getEntidadNombre(miembro).toLowerCase();
        const query = busqueda.trim().toLowerCase();

        // Buscador por texto
        const coincideTexto =
          !query ||
          userEmail.includes(query) ||
          userUid.includes(query) ||
          sedeNombre.includes(query) ||
          entidadNombre.includes(query) ||
          rol.toLowerCase().includes(query);

        if (!coincideTexto) return false;

        // Filtro por Rol
        if (rolFiltro && rol !== rolFiltro) return false;

        // Filtro por Estado
        if (filtroEstado === 'todos') return true;
        const estaBloqueado = miembro.bloqueado || miembro.estado === 'bloqueado';
        if (filtroEstado === 'activo') return !estaBloqueado;
        if (filtroEstado === 'bloqueado') return estaBloqueado;

        return true;
      }),
    [data.miembros, data.veterinarias, data.entidades, busqueda, rolFiltro, filtroEstado],
  );

  // Paginación responsiva universal
  const { page, setPage, pageSize, totalPages, totalItems, pagedItems } = useResponsivePagination(filtrados);

  // Filtrar veterinarias según la entidad seleccionada en el modal de invitación
  const veterinariasFiltradas = useMemo(() => {
    if (!entidadId) return [];
    return data.veterinarias.filter((v) => v.entidadId === entidadId);
  }, [data.veterinarias, entidadId]);

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
          dto.accountType = 'entidad';
          dto.accountId = entidadId;
          dto.planOwnerType = 'entidad';
          dto.planOwnerId = entidadId;
          dto.vinculoTipo = 'freelance';
        }

        await crearInvitacionV2(dto);
        toast(`Invitación enviada con éxito a ${email.trim()}`, 'success');
      }
      setEmail('');
      setVeterinariaId('');
      setShowInviteModal(false);
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
    <div className="grid gap-6" data-testid="superadmin-usuarios-panel">
      {/* Tabla de Usuarios a Pantalla Completa */}
      <Card className="premium-card flex flex-col gap-4">
        <SectionHeader
          title="Usuarios y miembros"
          description="Miembros globales en tabla estructurada con paginación adaptativa. Filtra por rol, estado o busca por correo."
          action={
            <Button variant="primary" onClick={() => setShowInviteModal(true)}>
              ✉️ Invitar Nuevo Usuario
            </Button>
          }
        />

        {/* Barra de Filtros y Búsqueda */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-2">
          <input
            type="text"
            placeholder="🔍 Buscar correo, sede o entidad..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={inputStyle}
            className="w-full"
          />
          <select
            aria-label="Filtrar usuarios por rol"
            value={rolFiltro}
            onChange={(e) => setRolFiltro(e.target.value)}
            style={inputStyle}
            className="w-full"
          >
            <option value="">Todos los roles</option>
            <option value="superadmin">superadmin</option>
            <option value="admin_entidad">admin_entidad</option>
            <option value="admin_veterinaria">admin_veterinaria</option>
            <option value="veterinario">veterinario</option>
            <option value="admin">admin legacy</option>
            <option value="vet">vet legacy</option>
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={inputStyle}
            className="w-full"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">✅ Activos</option>
            <option value="bloqueado">🚫 Bloqueados</option>
          </select>
        </div>

        {filtrados.length === 0 ? (
          <EmptyState
            variant="controlled"
            titulo="Sin usuarios para el filtro seleccionado"
            mensaje="Ajusta el texto de búsqueda, rol o estado para revisar los miembros de la plataforma."
          />
        ) : (
          <>
            {/* Vista de Tabla Estructurada */}
            <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Usuario / Correo</th>
                    <th className="py-3 px-3">Rol V2</th>
                    <th className="py-3 px-3">Sede / Veterinaria</th>
                    <th className="py-3 px-3">Entidad</th>
                    <th className="py-3 px-3">Registro</th>
                    <th className="py-3 px-3">Vigencia Trial</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {pagedItems.map((miembro) => {
                    const actual = esCuentaActual(data.me, miembro);
                    const bloqueado = miembro.bloqueado || miembro.estado === 'bloqueado';
                    const nombre = miembro.email ?? miembro.uid;
                    const fechaRegistroStr = formatFechaRegistro(miembro.creadoEn ?? miembro.createdAt);
                    const sedeNombre = getSedeNombre(miembro);
                    const entidadNombre = getEntidadNombre(miembro);

                    // Buscar suscripción asociada al planOwner/veterinaria/orgId del usuario
                    const sub = data.suscripciones.find(
                      (s) =>
                        s.planOwnerId === miembro.planOwnerId ||
                        s.veterinariaId === miembro.veterinariaId ||
                        s.orgId === miembro.orgId,
                    );
                    const trialInfo = sub
                      ? calcularTiempoTrialRestante(sub.trialHasta, sub.creadoEn ?? sub.createdAt, sub.estado)
                      : calcularTiempoTrialRestante(null, miembro.creadoEn ?? miembro.createdAt, miembro.estado);

                    return (
                      <tr key={miembro.id} className="hover:bg-[var(--surface-2)] transition-colors">
                        <td className="py-3 px-3">
                          <strong className="text-sm font-bold text-[var(--text)] block">{nombre}</strong>
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-[var(--text)]">
                          {miembro.role ?? miembro.rol}
                        </td>
                        <td className="py-3 px-3 font-bold text-[var(--text)]">
                          {sedeNombre}
                        </td>
                        <td className="py-3 px-3 text-[var(--muted)]">
                          {entidadNombre}
                        </td>
                        <td className="py-3 px-3 font-mono text-[var(--text)] whitespace-nowrap">
                          📅 {fechaRegistroStr}
                        </td>
                        <td className="py-3 px-3">
                          {trialInfo.esTrial ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-[11px] whitespace-nowrap ${
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
                              💳 Activo
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <Badge estado={estadoMiembro(miembro)}>{estadoMiembro(miembro)}</Badge>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Button
                            variant={bloqueado ? 'success' : 'danger'}
                            aria-label={actual ? 'Cuenta actual sin accion' : `${bloqueado ? 'Activar' : 'Desactivar'} usuario ${nombre}`}
                            onClick={() => onToggleBloqueo(miembro)}
                            disabled={actual || actionState.cambiarBloqueo}
                          >
                            {actual ? 'Cuenta actual' : bloqueado ? 'Activar' : 'Desactivar'}
                          </Button>
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

      {/* Modal / Popup de Invitación de Usuario */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text)]">✉️ Invitar nuevo usuario</h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-[var(--muted)] hover:text-[var(--text)] text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Envía una invitación global con rol y scope específicos a un nuevo miembro.
            </p>

            <form onSubmit={handleInvite} className="flex flex-col gap-4 mt-1">
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

              <div className="flex gap-2 justify-end mt-3">
                <Button variant="ghost" type="button" onClick={() => setShowInviteModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar Invitación'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
