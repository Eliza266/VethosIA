import React from 'react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { BackofficeEntidad } from '../../features/backoffice/api';
import type { EntidadDraft, SuperAdminActionState, SuperAdminDataset } from './types';
import { consumoLabel, itemStyle, lineStyle, listStyle, inputStyle, text } from './utils';

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
  const nuevaError = !nueva.nombre.trim() ? 'Completa nombre de entidad.' : null;
  return (
    <div className="grid gap-5" data-testid="superadmin-entidades-panel">
      <Card className="premium-card">
        <SectionHeader
          title="Entidades"
          description="Listado, detalle y edición global de entidades. No crea usuarios, claims ni suscripciones automáticamente."
        />
        <section aria-label="Crear entidad global" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input aria-label="Nombre entidad global" placeholder="Nombre" value={nueva.nombre} onChange={(e) => setNueva((c) => ({ ...c, nombre: e.target.value }))} style={inputStyle} />
          <select aria-label="Tipo entidad global" value={nueva.tipo} onChange={(e) => setNueva((c) => ({ ...c, tipo: e.target.value as EntidadDraft['tipo'] }))} style={inputStyle}>
            <option value="">Tipo</option><option value="gobierno">gobierno</option><option value="cadena">cadena</option><option value="ong">ong</option><option value="entidad">entidad</option>
          </select>
          <input aria-label="Ciudad entidad global" placeholder="Ciudad" value={nueva.ciudad} onChange={(e) => setNueva((c) => ({ ...c, ciudad: e.target.value }))} style={inputStyle} />
          <input aria-label="Correo entidad global" placeholder="Correo contacto" value={nueva.emailContacto} onChange={(e) => setNueva((c) => ({ ...c, emailContacto: e.target.value }))} style={inputStyle} />
          <Button onClick={onCreate} disabled={Boolean(nuevaError) || actionState.crearEntidad}>Crear entidad</Button>
        </section>
        {nuevaError && <p className="mt-2 text-sm text-[var(--muted)]">{nuevaError}</p>}
      </Card>

      <Card className="premium-card">
        <SectionHeader title="Entidades globales" description="Sedes, consumo y estado asociado por entidad." />
        {data.entidades.length === 0 ? (
          <EmptyState
            variant="controlled"
            titulo="Sin entidades registradas"
            mensaje="La consola está lista para crear y auditar entidades globales sin crear usuarios ni claims automáticamente."
          />
        ) : null}
        <ul style={listStyle} className="mt-4">
          {data.entidades.map((entidad) => {
            const sedes = data.relations.sedesByEntidad.get(entidad.id) ?? [];
            const consumos = data.relations.consumoByEntidad.get(entidad.id) ?? [];
            const editando = editId === entidad.id;
            return (
              <li key={entidad.id} style={itemStyle}>
                <div style={lineStyle}>
                  <div><strong>{entidad.nombre}</strong><div className="text-sm text-[var(--muted)]">{text(entidad.tipo, 'entidad')} - {text(entidad.ciudad)} - {text(entidad.pais)}</div></div>
                  <Badge estado={entidad.estado}>{entidad.estado}</Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm"><span>{sedes.length} sedes</span><span>Consumo {consumoLabel(consumos)}</span><span>{text(entidad.emailContacto, 'Sin correo')}</span></div>
                {editando ? (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
                    <input aria-label={`Nombre entidad ${entidad.nombre}`} value={draft.nombre} onChange={(e) => setDraft((c) => ({ ...c, nombre: e.target.value }))} style={inputStyle} />
                    <select aria-label={`Tipo entidad ${entidad.nombre}`} value={draft.tipo} onChange={(e) => setDraft((c) => ({ ...c, tipo: e.target.value as EntidadDraft['tipo'] }))} style={inputStyle}>
                      <option value="">Tipo</option><option value="gobierno">gobierno</option><option value="cadena">cadena</option><option value="ong">ong</option><option value="entidad">entidad</option>
                    </select>
                    <input aria-label={`Ciudad entidad ${entidad.nombre}`} value={draft.ciudad} onChange={(e) => setDraft((c) => ({ ...c, ciudad: e.target.value }))} style={inputStyle} />
                    <input aria-label={`Correo entidad ${entidad.nombre}`} value={draft.emailContacto} onChange={(e) => setDraft((c) => ({ ...c, emailContacto: e.target.value }))} style={inputStyle} />
                    <select aria-label={`Estado entidad ${entidad.nombre}`} value={draft.estado} onChange={(e) => setDraft((c) => ({ ...c, estado: e.target.value === 'inactiva' ? 'inactiva' : 'activa' }))} style={inputStyle}>
                      <option value="activa">activa</option><option value="inactiva">inactiva</option>
                    </select>
                    <div className="flex gap-2"><Button aria-label={`Guardar entidad ${entidad.nombre}`} onClick={() => onSave(entidad.id, draft)} disabled={!draft.nombre.trim() || actionState.editarEntidad}>Guardar</Button><Button variant="ghost" onClick={onEditCancel}>Cancelar</Button></div>
                  </div>
                ) : <Button variant="ghost" aria-label={`Editar entidad ${entidad.nombre}`} onClick={() => onEditStart(entidad)}>Editar entidad</Button>}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
};
