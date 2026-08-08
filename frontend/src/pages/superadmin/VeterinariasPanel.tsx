import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { BackofficeVeterinaria } from '../../features/backoffice/api';
import type { SedeCreateDraft, SedeDraft, SuperAdminActionState, SuperAdminDataset } from './types';
import { consumoLabel, inputStyle, optionalText, text } from './utils';
import { TablePaginationControls, useResponsivePagination } from './TablePagination';

export const VeterinariasPanel: React.FC<{
  data: SuperAdminDataset;
  nueva: SedeCreateDraft;
  setNueva: React.Dispatch<React.SetStateAction<SedeCreateDraft>>;
  editId: string | null;
  draft: SedeDraft;
  setDraft: React.Dispatch<React.SetStateAction<SedeDraft>>;
  onCreate: () => void;
  onEditStart: (sede: BackofficeVeterinaria) => void;
  onEditCancel: () => void;
  onSave: (id: string, input: SedeDraft) => void;
  actionState: SuperAdminActionState;
}> = ({ data, nueva, setNueva, editId, draft, setDraft, onCreate, onEditStart, onEditCancel, onSave, actionState }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const nuevaError = !nueva.entidadId ? 'Selecciona entidad objetivo.' : !nueva.nombre.trim() ? 'Completa nombre de sede.' : null;

  // Filtrado reactivo de veterinarias / sedes
  const veterinariasFiltradas = useMemo(() => {
    return data.veterinarias.filter((sede) => {
      const entidad = sede.entidadId ? data.relations.entidadById.get(sede.entidadId) : undefined;
      const nombreSede = (sede.nombre || '').toLowerCase();
      const ciudad = (sede.ciudad || '').toLowerCase();
      const pais = (sede.pais || '').toLowerCase();
      const email = (sede.emailContacto || '').toLowerCase();
      const nombreEntidad = (entidad?.nombre || 'clínica independiente').toLowerCase();
      const query = busqueda.trim().toLowerCase();

      const coincideTexto =
        !query ||
        nombreSede.includes(query) ||
        ciudad.includes(query) ||
        pais.includes(query) ||
        email.includes(query) ||
        nombreEntidad.includes(query);

      if (!coincideTexto) return false;

      if (filtroEstado === 'todos') return true;
      const estadoActual = (sede.estado || 'activa').toLowerCase();
      if (filtroEstado === 'activa') return estadoActual === 'activa';
      if (filtroEstado === 'inactiva') return estadoActual === 'inactiva';
      return true;
    });
  }, [data.veterinarias, data.relations.entidadById, busqueda, filtroEstado]);

  // Paginación responsiva universal
  const { page, setPage, pageSize, totalPages, totalItems, pagedItems } = useResponsivePagination(veterinariasFiltradas);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nuevaError) return;
    onCreate();
    setShowCreateModal(false);
  };

  return (
    <div className="grid gap-5" data-testid="superadmin-veterinarias-panel">
      {/* Tabla con Filtros para Sedes Registradas */}
      <Card className="premium-card">
        <SectionHeader
          title="Sedes y Veterinarias"
          description="Detalle operativo, entidad asociada, veterinarios vinculados y consumo en tabla con paginación adaptativa."
          action={
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              🏥 Crear Nueva Sede
            </Button>
          }
        />

        {/* Controles de Filtros */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            type="text"
            placeholder="🔍 Buscar por sede, ciudad, correo o entidad..."
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
            <option value="activa">✅ Activas</option>
            <option value="inactiva">🚫 Inactivas</option>
          </select>
          <div className="flex items-center justify-end text-xs text-[var(--muted)] font-bold">
            Total: {veterinariasFiltradas.length} sedes
          </div>
        </div>

        {veterinariasFiltradas.length === 0 ? (
          <EmptyState
            variant="controlled"
            titulo="Sin sedes para los filtros seleccionados"
            mensaje="Ajusta la búsqueda o los filtros para visualizar las sedes globales."
          />
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Sede / Veterinaria</th>
                    <th className="py-3 px-3">Entidad Asociada</th>
                    <th className="py-3 px-3">Ubicación</th>
                    <th className="py-3 px-3">Correo Contacto</th>
                    <th className="py-3 px-3">Equipo</th>
                    <th className="py-3 px-3">Consumo SOAP</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {pagedItems.map((sede) => {
                    const vets = data.relations.vetsBySede.get(sede.id) ?? [];
                    const consumos = data.relations.consumoBySede.get(sede.id) ?? [];
                    const entidad = sede.entidadId ? data.relations.entidadById.get(sede.entidadId) : undefined;
                    const editando = editId === sede.id;
                    const nombreEntidadLegible = entidad?.nombre || (sede.entidadId ? 'Entidad Registrada' : 'Clínica Independiente');

                    return (
                      <React.Fragment key={sede.id}>
                        <tr className="hover:bg-[var(--surface-2)] transition-colors">
                          <td className="py-3 px-3">
                            <strong className="text-sm font-bold text-[var(--text)] block">{sede.nombre}</strong>
                          </td>
                          <td className="py-3 px-3 font-medium text-[var(--text)]">
                            {nombreEntidadLegible}
                          </td>
                          <td className="py-3 px-3 text-[var(--muted)]">
                            {text(sede.ciudad, 'Sin ciudad')}{sede.pais ? `, ${sede.pais}` : ''}
                          </td>
                          <td className="py-3 px-3 font-mono text-[var(--text)]">
                            {text(sede.emailContacto, 'Sin correo')}
                          </td>
                          <td className="py-3 px-3 font-medium text-[var(--text)]">
                            👥 {vets.length} vet{vets.length === 1 ? '' : 's'}
                          </td>
                          <td className="py-3 px-3 font-mono text-[var(--text)]">
                            {consumoLabel(consumos)}
                          </td>
                          <td className="py-3 px-3">
                            <Badge estado={sede.estado}>{sede.estado}</Badge>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Button
                              variant="secondary"
                              aria-label={`Editar sede ${sede.nombre}`}
                              onClick={() => onEditStart(sede)}
                            >
                              ✏️ Editar
                            </Button>
                          </td>
                        </tr>

                        {editando && (
                          <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                            <td colSpan={8} className="p-3">
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)]">
                                <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                                  <span>Nombre de la sede</span>
                                  <input
                                    aria-label={`Nombre sede ${sede.nombre}`}
                                    value={draft.nombre}
                                    onChange={(e) => setDraft((c) => ({ ...c, nombre: e.target.value }))}
                                    style={inputStyle}
                                  />
                                </label>
                                <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                                  <span>Ciudad</span>
                                  <input
                                    aria-label={`Ciudad sede ${sede.nombre}`}
                                    value={draft.ciudad ?? ''}
                                    onChange={(e) => setDraft((c) => ({ ...c, ciudad: optionalText(e.target.value) }))}
                                    style={inputStyle}
                                  />
                                </label>
                                <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                                  <span>Estado</span>
                                  <select
                                    aria-label={`Estado sede ${sede.nombre}`}
                                    value={draft.estado}
                                    onChange={(e) => setDraft((c) => ({ ...c, estado: e.target.value === 'inactiva' ? 'inactiva' : 'activa' }))}
                                    style={inputStyle}
                                  >
                                    <option value="activa">activa</option>
                                    <option value="inactiva">inactiva</option>
                                  </select>
                                </label>
                                <div className="flex gap-2 items-end">
                                  <Button
                                    aria-label={`Guardar sede ${sede.nombre}`}
                                    onClick={() => onSave(sede.id, draft)}
                                    disabled={!draft.nombre.trim() || actionState.editarSede}
                                  >
                                    Guardar
                                  </Button>
                                  <Button variant="ghost" onClick={onEditCancel}>Cancelar</Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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

      {/* Modal Popup para Crear Nueva Sede */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text)]">🏥 Crear Nueva Sede / Veterinaria</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[var(--muted)] hover:text-[var(--text)] text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              La creación global exige una entidad objetivo explícita para asociar la sede.
            </p>

            <form onSubmit={handleCreateSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mt-1">
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)] md:col-span-2 xl:col-span-3">
                <span>Entidad objetivo</span>
                <select
                  aria-label="Entidad objetivo sede"
                  value={nueva.entidadId}
                  onChange={(e) => setNueva((c) => ({ ...c, entidadId: e.target.value }))}
                  style={inputStyle}
                  required
                >
                  <option value="">-- Selecciona Entidad Objetivo --</option>
                  {data.entidades.map((entidad) => (
                    <option key={entidad.id} value={entidad.id}>
                      {entidad.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Nombre de la sede</span>
                <input
                  aria-label="Nombre sede global"
                  placeholder="Ej. Sede Norte"
                  value={nueva.nombre}
                  onChange={(e) => setNueva((c) => ({ ...c, nombre: e.target.value }))}
                  style={inputStyle}
                  required
                />
              </label>

              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Ciudad</span>
                <input
                  aria-label="Ciudad sede global"
                  placeholder="Ej. Bogotá"
                  value={nueva.ciudad}
                  onChange={(e) => setNueva((c) => ({ ...c, ciudad: e.target.value }))}
                  style={inputStyle}
                />
              </label>

              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>País</span>
                <input
                  aria-label="Pais sede global"
                  placeholder="Ej. Colombia"
                  value={nueva.pais}
                  onChange={(e) => setNueva((c) => ({ ...c, pais: e.target.value }))}
                  style={inputStyle}
                />
              </label>

              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)] md:col-span-2 xl:col-span-3">
                <span>Correo contacto</span>
                <input
                  aria-label="Correo sede global"
                  placeholder="Ej. contacto@sede.com"
                  value={nueva.emailContacto}
                  onChange={(e) => setNueva((c) => ({ ...c, emailContacto: e.target.value }))}
                  style={inputStyle}
                />
              </label>

              <div className="md:col-span-2 xl:col-span-3 flex gap-2 justify-end mt-4">
                <Button variant="ghost" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={Boolean(nuevaError) || actionState.crearSede}>
                  Crear sede
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
