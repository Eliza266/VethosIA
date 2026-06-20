import React from 'react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { BackofficeVeterinaria } from '../../features/backoffice/api';
import type { SedeCreateDraft, SedeDraft, SuperAdminActionState, SuperAdminDataset } from './types';
import { consumoLabel, inputStyle, itemStyle, lineStyle, listStyle, optionalText, text } from './utils';

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
  const nuevaError = !nueva.entidadId ? 'Selecciona entidad objetivo.' : !nueva.nombre.trim() ? 'Completa nombre de sede.' : null;
  return (
    <div className="grid gap-5" data-testid="superadmin-veterinarias-panel">
      <Card className="premium-card">
        <SectionHeader title="Veterinarias y sedes" description="Creación global exige entidad objetivo explícita. Edición limitada a campos validados por backend." />
        <section aria-label="Crear sede global" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select aria-label="Entidad objetivo sede" value={nueva.entidadId} onChange={(e) => setNueva((c) => ({ ...c, entidadId: e.target.value }))} style={inputStyle}>
            <option value="">Entidad objetivo</option>
            {data.entidades.map((entidad) => <option key={entidad.id} value={entidad.id}>{entidad.nombre}</option>)}
          </select>
          <input aria-label="Nombre sede global" placeholder="Nombre sede" value={nueva.nombre} onChange={(e) => setNueva((c) => ({ ...c, nombre: e.target.value }))} style={inputStyle} />
          <input aria-label="Ciudad sede global" placeholder="Ciudad" value={nueva.ciudad} onChange={(e) => setNueva((c) => ({ ...c, ciudad: e.target.value }))} style={inputStyle} />
          <input aria-label="Pais sede global" placeholder="País" value={nueva.pais} onChange={(e) => setNueva((c) => ({ ...c, pais: e.target.value }))} style={inputStyle} />
          <input aria-label="Correo sede global" placeholder="Correo contacto" value={nueva.emailContacto} onChange={(e) => setNueva((c) => ({ ...c, emailContacto: e.target.value }))} style={inputStyle} />
          <Button onClick={onCreate} disabled={Boolean(nuevaError) || actionState.crearSede}>Crear sede</Button>
        </section>
        {nuevaError && <p className="mt-2 text-sm text-[var(--muted)]">{nuevaError}</p>}
      </Card>

      <Card className="premium-card">
        <SectionHeader title="Sedes registradas" description="Detalle operativo, entidad asociada, veterinarios vinculados y consumo." />
        {data.veterinarias.length === 0 ? (
          <EmptyState
            variant="controlled"
            titulo="Sin sedes globales"
            mensaje="Las veterinarias aparecerán aquí con entidad objetivo, equipo vinculado y consumo cuando existan."
          />
        ) : null}
        <ul style={listStyle} className="mt-4">
          {data.veterinarias.map((sede) => {
            const vets = data.relations.vetsBySede.get(sede.id) ?? [];
            const consumos = data.relations.consumoBySede.get(sede.id) ?? [];
            const entidad = sede.entidadId ? data.relations.entidadById.get(sede.entidadId) : undefined;
            const editando = editId === sede.id;
            return (
              <li key={sede.id} style={itemStyle}>
                <div style={lineStyle}>
                  <div><strong>{sede.nombre}</strong><div className="text-sm text-[var(--muted)]">{entidad?.nombre ?? text(sede.entidadId ?? sede.planOwnerId)} - {text(sede.ciudad)}</div></div>
                  <Badge estado={sede.estado}>{sede.estado}</Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm"><span>{vets.length} veterinarios</span><span>Consumo {consumoLabel(consumos)}</span><span>{text(sede.emailContacto, 'Sin correo')}</span></div>
                {editando ? (
                  <div className="grid gap-2 md:grid-cols-5">
                    <input aria-label={`Nombre sede ${sede.nombre}`} value={draft.nombre} onChange={(e) => setDraft((c) => ({ ...c, nombre: e.target.value }))} style={inputStyle} />
                    <input aria-label={`Ciudad sede ${sede.nombre}`} value={draft.ciudad ?? ''} onChange={(e) => setDraft((c) => ({ ...c, ciudad: optionalText(e.target.value) }))} style={inputStyle} />
                    <select aria-label={`Estado sede ${sede.nombre}`} value={draft.estado} onChange={(e) => setDraft((c) => ({ ...c, estado: e.target.value === 'inactiva' ? 'inactiva' : 'activa' }))} style={inputStyle}>
                      <option value="activa">activa</option><option value="inactiva">inactiva</option>
                    </select>
                    <Button aria-label={`Guardar sede ${sede.nombre}`} onClick={() => onSave(sede.id, draft)} disabled={!draft.nombre.trim() || actionState.editarSede}>Guardar</Button>
                    <Button variant="ghost" onClick={onEditCancel}>Cancelar</Button>
                  </div>
                ) : <Button variant="ghost" aria-label={`Editar sede ${sede.nombre}`} onClick={() => onEditStart(sede)}>Editar sede</Button>}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
};
