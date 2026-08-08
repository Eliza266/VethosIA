import React, { useMemo, useState } from 'react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { BackofficeEntidad } from '../../features/backoffice/api';
import type { EntidadDraft, SuperAdminActionState, SuperAdminDataset } from './types';
import { consumoLabel, inputStyle, text } from './utils';
import { splitPhone, joinPhone } from '../../lib/phone';
import PhoneInput from '../../components/ui/PhoneInput';
import { TablePaginationControls, useResponsivePagination } from './TablePagination';

export const EntidadesPanel: React.FC<{
  data: SuperAdminDataset;
  nueva: EntidadDraft;
  setNueva: React.Dispatch<React.SetStateAction<EntidadDraft>>;
  editId: string | null;
  draft: EntidadDraft;
  setDraft: React.Dispatch<React.SetStateAction<EntidadDraft>>;
  onCreate: () => void;
  onEditStart: (entidad: BackofficeEntidad) => void;
  onEditCancel: () => void;
  onSave: (id: string, input: EntidadDraft) => void;
  actionState: SuperAdminActionState;
}> = ({ data, nueva, setNueva, editId, draft, setDraft, onCreate, onEditStart, onEditCancel, onSave, actionState }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const nuevaError = !nueva.nombre.trim() ? 'Completa nombre de entidad.' : null;
  const nuevaTel = splitPhone(nueva.telefono);
  const draftTel = splitPhone(draft.telefono);

  // Filtrado reactivo de entidades
  const entidadesFiltradas = useMemo(() => {
    return data.entidades.filter((entidad) => {
      const nombre = (entidad.nombre || '').toLowerCase();
      const tipo = (entidad.tipo || '').toLowerCase();
      const ciudad = (entidad.ciudad || '').toLowerCase();
      const pais = (entidad.pais || '').toLowerCase();
      const email = (entidad.emailContacto || '').toLowerCase();
      const query = busqueda.trim().toLowerCase();

      const coincideTexto =
        !query ||
        nombre.includes(query) ||
        tipo.includes(query) ||
        ciudad.includes(query) ||
        pais.includes(query) ||
        email.includes(query);

      if (!coincideTexto) return false;
      if (tipoFiltro && tipo !== tipoFiltro.toLowerCase()) return false;

      if (filtroEstado === 'todos') return true;
      const estadoActual = (entidad.estado || 'activa').toLowerCase();
      if (filtroEstado === 'activa') return estadoActual === 'activa';
      if (filtroEstado === 'inactiva') return estadoActual === 'inactiva';
      return true;
    });
  }, [data.entidades, busqueda, tipoFiltro, filtroEstado]);

  // Paginación responsiva universal
  const { page, setPage, pageSize, totalPages, totalItems, pagedItems } = useResponsivePagination(entidadesFiltradas);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nueva.nombre.trim()) return;
    onCreate();
    setShowCreateModal(false);
  };

  return (
    <div className="grid gap-5" data-testid="superadmin-entidades-panel">
      {/* Tabla con Filtros para Entidades Registradas */}
      <Card className="premium-card">
        <SectionHeader
          title="Entidades globales"
          description="Sedes, consumo y estado asociado por entidad en vista estructurada con paginación adaptativa."
          action={
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              🏢 Crear Nueva Entidad
            </Button>
          }
        />

        {/* Barra de Filtros */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input
            type="text"
            placeholder="🔍 Buscar por entidad, ciudad, correo o tipo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={inputStyle}
            className="w-full"
          />
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
            style={inputStyle}
            className="w-full"
          >
            <option value="">Todos los tipos de org</option>
            <option value="gobierno">gobierno</option>
            <option value="cadena">cadena</option>
            <option value="ong">ong</option>
            <option value="entidad">entidad</option>
          </select>
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
        </div>

        {entidadesFiltradas.length === 0 ? (
          <EmptyState
            variant="controlled"
            titulo="Sin entidades para el filtro seleccionado"
            mensaje="Ajusta la búsqueda o los filtros para revisar las entidades globales."
          />
        ) : (
          <>
            {/* Vista de Tabla Estructurada */}
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Entidad</th>
                    <th className="py-3 px-3">Tipo Org</th>
                    <th className="py-3 px-3">Ubicación</th>
                    <th className="py-3 px-3">Correo Contacto</th>
                    <th className="py-3 px-3">Teléfono</th>
                    <th className="py-3 px-3">Sedes</th>
                    <th className="py-3 px-3">Consumo SOAP</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {pagedItems.map((entidad) => {
                    const sedes = data.relations.sedesByEntidad.get(entidad.id) ?? [];
                    const consumos = data.relations.consumoByEntidad.get(entidad.id) ?? [];
                    const editando = editId === entidad.id;

                    return (
                      <React.Fragment key={entidad.id}>
                        <tr className="hover:bg-[var(--surface-2)] transition-colors">
                          <td className="py-3 px-3">
                            <strong className="text-sm font-bold text-[var(--text)] block">{entidad.nombre}</strong>
                          </td>
                          <td className="py-3 px-3 capitalize font-medium text-[var(--text)]">
                            {text(entidad.tipo, 'entidad')}
                          </td>
                          <td className="py-3 px-3 text-[var(--muted)]">
                            {text(entidad.ciudad, 'Sin ciudad')}{entidad.pais ? `, ${entidad.pais}` : ''}
                          </td>
                          <td className="py-3 px-3 font-mono text-[var(--text)]">
                            {text(entidad.emailContacto, 'Sin correo')}
                          </td>
                          <td className="py-3 px-3 font-mono text-[var(--muted)]">
                            {text(entidad.telefono, 'Sin teléfono')}
                          </td>
                          <td className="py-3 px-3 font-bold text-[var(--text)]">
                            🏥 {sedes.length} sede{sedes.length === 1 ? '' : 's'}
                          </td>
                          <td className="py-3 px-3 font-mono text-[var(--text)]">
                            {consumoLabel(consumos)}
                          </td>
                          <td className="py-3 px-3">
                            <Badge estado={entidad.estado}>{entidad.estado}</Badge>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Button
                              variant="secondary"
                              aria-label={`Editar entidad ${entidad.nombre}`}
                              onClick={() => onEditStart(entidad)}
                            >
                              ✏️ Editar
                            </Button>
                          </td>
                        </tr>

                        {editando && (
                          <tr className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                            <td colSpan={9} className="p-3">
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)]">
                                <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                                  <span>Nombre de la entidad</span>
                                  <input aria-label={`Nombre entidad ${entidad.nombre}`} value={draft.nombre} onChange={(e) => setDraft((c) => ({ ...c, nombre: e.target.value }))} style={inputStyle} />
                                </label>
                                <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                                  <span>Tipo de organización</span>
                                  <select aria-label={`Tipo entidad ${entidad.nombre}`} value={draft.tipo} onChange={(e) => setDraft((c) => ({ ...c, tipo: e.target.value as EntidadDraft['tipo'] }))} style={inputStyle}>
                                    <option value="">Selecciona tipo</option>
                                    <option value="gobierno">gobierno</option>
                                    <option value="cadena">cadena</option>
                                    <option value="ong">ong</option>
                                    <option value="entidad">entidad</option>
                                  </select>
                                </label>
                                <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                                  <span>Dirección</span>
                                  <input aria-label={`Dirección entidad ${entidad.nombre}`} placeholder="Ej. Calle 123 #45-67" value={draft.direccion} onChange={(e) => setDraft((c) => ({ ...c, direccion: e.target.value }))} style={inputStyle} />
                                </label>
                                <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                                  <span>Ciudad</span>
                                  <input aria-label={`Ciudad entidad ${entidad.nombre}`} value={draft.ciudad} onChange={(e) => setDraft((c) => ({ ...c, ciudad: e.target.value }))} style={inputStyle} />
                                </label>
                                <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                                  <span>País</span>
                                  <input aria-label={`País entidad ${entidad.nombre}`} placeholder="Ej. Colombia" value={draft.pais} onChange={(e) => setDraft((c) => ({ ...c, pais: e.target.value }))} style={inputStyle} />
                                </label>
                                <PhoneInput
                                  id={`entidad-draft-telefono-${entidad.id}`}
                                  key={editId ?? entidad.id}
                                  label="Teléfono"
                                  pais={draftTel.pais}
                                  numero={draftTel.numero}
                                  onChangePais={(p) => setDraft((c) => ({ ...c, telefono: joinPhone(p, draftTel.numero) }))}
                                  onChangeNumero={(n) => setDraft((c) => ({ ...c, telefono: joinPhone(draftTel.pais, n) }))}
                                />
                                <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                                  <span>Correo contacto</span>
                                  <input aria-label={`Correo entidad ${entidad.nombre}`} value={draft.emailContacto} onChange={(e) => setDraft((c) => ({ ...c, emailContacto: e.target.value }))} style={inputStyle} />
                                </label>
                                <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                                  <span>Estado</span>
                                  <select aria-label={`Estado entidad ${entidad.nombre}`} value={draft.estado} onChange={(e) => setDraft((c) => ({ ...c, estado: e.target.value === 'inactiva' ? 'inactiva' : 'activa' }))} style={inputStyle}>
                                    <option value="activa">activa</option>
                                    <option value="inactiva">inactiva</option>
                                  </select>
                                </label>
                                <div className="flex gap-2 items-end col-span-full justify-end">
                                  <Button aria-label={`Guardar entidad ${entidad.nombre}`} onClick={() => onSave(entidad.id, draft)} disabled={!draft.nombre.trim() || actionState.editarEntidad}>Guardar</Button>
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

      {/* Modal Popup para Crear Nueva Entidad */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[var(--text)]">🏢 Crear Nueva Entidad Global</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[var(--muted)] hover:text-[var(--text)] text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Crea una nueva organización o entidad global en la plataforma.
            </p>

            <form onSubmit={handleCreateSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mt-1">
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Nombre de la entidad</span>
                <input
                  aria-label="Nombre entidad global"
                  placeholder="Ej. Corporación Vethos"
                  value={nueva.nombre}
                  onChange={(e) => setNueva((c) => ({ ...c, nombre: e.target.value }))}
                  style={inputStyle}
                  required
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Tipo de organización</span>
                <select
                  aria-label="Tipo entidad global"
                  value={nueva.tipo}
                  onChange={(e) => setNueva((c) => ({ ...c, tipo: e.target.value as EntidadDraft['tipo'] }))}
                  style={inputStyle}
                >
                  <option value="">Selecciona tipo</option>
                  <option value="gobierno">gobierno</option>
                  <option value="cadena">cadena</option>
                  <option value="ong">ong</option>
                  <option value="entidad">entidad</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Dirección</span>
                <input
                  aria-label="Dirección entidad global"
                  placeholder="Ej. Calle 123 #45-67"
                  value={nueva.direccion}
                  onChange={(e) => setNueva((c) => ({ ...c, direccion: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>Ciudad</span>
                <input
                  aria-label="Ciudad entidad global"
                  placeholder="Ej. Bogotá"
                  value={nueva.ciudad}
                  onChange={(e) => setNueva((c) => ({ ...c, ciudad: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
                <span>País</span>
                <input
                  aria-label="País entidad global"
                  placeholder="Ej. Colombia"
                  value={nueva.pais}
                  onChange={(e) => setNueva((c) => ({ ...c, pais: e.target.value }))}
                  style={inputStyle}
                />
              </label>
              <PhoneInput
                id="entidad-nueva-telefono-modal"
                label="Teléfono"
                pais={nuevaTel.pais}
                numero={nuevaTel.numero}
                onChangePais={(p) => setNueva((c) => ({ ...c, telefono: joinPhone(p, nuevaTel.numero) }))}
                onChangeNumero={(n) => setNueva((c) => ({ ...c, telefono: joinPhone(nuevaTel.pais, n) }))}
              />
              <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)] md:col-span-2 xl:col-span-3">
                <span>Correo contacto</span>
                <input
                  aria-label="Correo entidad global"
                  placeholder="Ej. contacto@entidad.com"
                  value={nueva.emailContacto}
                  onChange={(e) => setNueva((c) => ({ ...c, emailContacto: e.target.value }))}
                  style={inputStyle}
                />
              </label>

              <div className="md:col-span-2 xl:col-span-3 flex gap-2 justify-end mt-4">
                <Button variant="ghost" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={Boolean(nuevaError) || actionState.crearEntidad}>
                  Crear entidad
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
