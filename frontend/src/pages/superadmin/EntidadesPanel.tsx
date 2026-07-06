import React from 'react';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { BackofficeEntidad } from '../../features/backoffice/api';
import type { EntidadDraft, SuperAdminActionState, SuperAdminDataset } from './types';
import { consumoLabel, itemStyle, lineStyle, listStyle, inputStyle, text } from './utils';
import { splitPhone, joinPhone } from '../../lib/phone';
import PhoneInput from '../../components/ui/PhoneInput';

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
  const nuevaTel = splitPhone(nueva.telefono);
  const draftTel = splitPhone(draft.telefono);
  return (
    <div className="grid gap-5" data-testid="superadmin-entidades-panel">
      <Card className="premium-card">
        <SectionHeader
          title="Entidades"
          description="Listado, detalle y edición global de entidades. No crea usuarios, claims ni suscripciones automáticamente."
        />
        <section aria-label="Crear entidad global" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
            <span>Nombre de la entidad</span>
            <input aria-label="Nombre entidad global" placeholder="Ej. Corporación Vethos" value={nueva.nombre} onChange={(e) => setNueva((c) => ({ ...c, nombre: e.target.value }))} style={inputStyle} />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
            <span>Tipo de organización</span>
            <select aria-label="Tipo entidad global" value={nueva.tipo} onChange={(e) => setNueva((c) => ({ ...c, tipo: e.target.value as EntidadDraft['tipo'] }))} style={inputStyle}>
              <option value="">Selecciona tipo</option>
              <option value="gobierno">gobierno</option>
              <option value="cadena">cadena</option>
              <option value="ong">ong</option>
              <option value="entidad">entidad</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
            <span>Dirección</span>
            <input aria-label="Dirección entidad global" placeholder="Ej. Calle 123 #45-67" value={nueva.direccion} onChange={(e) => setNueva((c) => ({ ...c, direccion: e.target.value }))} style={inputStyle} />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
            <span>Ciudad</span>
            <input aria-label="Ciudad entidad global" placeholder="Ej. Bogotá" value={nueva.ciudad} onChange={(e) => setNueva((c) => ({ ...c, ciudad: e.target.value }))} style={inputStyle} />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
            <span>País</span>
            <input aria-label="País entidad global" placeholder="Ej. Colombia" value={nueva.pais} onChange={(e) => setNueva((c) => ({ ...c, pais: e.target.value }))} style={inputStyle} />
          </label>
          <PhoneInput
            id="entidad-nueva-telefono"
            label="Teléfono"
            pais={nuevaTel.pais}
            numero={nuevaTel.numero}
            onChangePais={(p) => setNueva((c) => ({ ...c, telefono: joinPhone(p, nuevaTel.numero) }))}
            onChangeNumero={(n) => setNueva((c) => ({ ...c, telefono: joinPhone(nuevaTel.pais, n) }))}
          />
          <label className="grid gap-1 text-xs font-black uppercase tracking-wider text-[var(--muted)]">
            <span>Correo contacto</span>
            <input aria-label="Correo entidad global" placeholder="Ej. contacto@entidad.com" value={nueva.emailContacto} onChange={(e) => setNueva((c) => ({ ...c, emailContacto: e.target.value }))} style={inputStyle} />
          </label>
          <div className="flex items-end">
            <Button onClick={onCreate} disabled={Boolean(nuevaError) || actionState.crearEntidad}>Crear entidad</Button>
          </div>
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
                  <div className="grid gap-3 mt-3 md:grid-cols-2 xl:grid-cols-4 border-t border-[var(--border)] pt-3">
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
                    <div className="flex gap-2 items-end">
                      <Button aria-label={`Guardar entidad ${entidad.nombre}`} onClick={() => onSave(entidad.id, draft)} disabled={!draft.nombre.trim() || actionState.editarEntidad}>Guardar</Button>
                      <Button variant="ghost" onClick={onEditCancel}>Cancelar</Button>
                    </div>
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
