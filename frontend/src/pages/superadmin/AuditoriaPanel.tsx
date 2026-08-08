import React, { useMemo, useState } from 'react';
import { Activity, FileClock, Search, ShieldCheck, Users } from 'lucide-react';
import { Badge, Card, EmptyState, InfoTile, SectionHeader } from '../../components/ui/Primitives';
import type { BackofficeAuditoria } from '../../features/backoffice/api';
import type { SuperAdminDataset } from './types';
import { inputStyle } from './utils';
import { TablePaginationControls, useResponsivePagination } from './TablePagination';

// Diccionario de traducción de acciones técnicas a lenguaje claro
const ACCIONES_HUMANAS: Record<string, string> = {
  'historia.aprobar': 'Aprobación de Historia Clínica',
  'historia.crear': 'Creación de Historia Clínica',
  'pdf.exportar': 'Exportación de Documento PDF',
  'paciente.crear': 'Creación de Ficha de Paciente',
  'paciente.editar': 'Edición de Datos de Paciente',
  'soap.inicio': 'Inicio de Consulta SOAP con IA',
  'miembro.desactivar': 'Desactivación de Usuario',
  'miembro.activar': 'Activación de Usuario',
  'plan.actualizar': 'Actualización de Plan Comercial',
  'plan.crear': 'Creación de Plan Comercial',
  'trial.extender': 'Extensión de Prueba Gratuita',
  'suscripcion.estado': 'Cambio de Estado de Suscripción',
  'solicitud.aprobar': 'Aprobación de Vinculación Técnica',
  'solicitud.rechazar': 'Rechazo de Vinculación Técnica',
  'entidad.crear': 'Creación de Entidad Global',
  'sede.crear': 'Creación de Sede / Veterinaria',
};

export function traducirAccion(accionRaw?: string | null): string {
  if (!accionRaw) return 'Actividad del Sistema';
  const key = accionRaw.toLowerCase().trim();
  if (ACCIONES_HUMANAS[key]) return ACCIONES_HUMANAS[key];
  return accionRaw
    .replace(/\./g, ' › ')
    .replace(/^([a-z])/, (m) => m.toUpperCase());
}

export const AuditoriaPanel: React.FC<{
  eventos: BackofficeAuditoria[];
  dataset?: SuperAdminDataset;
}> = ({ eventos, dataset }) => {
  const [busqueda, setBusqueda] = useState('');
  const [accionFiltro, setAccionFiltro] = useState('');

  // Resolver nombre de actor
  const getActorNombre = (actorUid?: string | null): string => {
    if (!actorUid || actorUid === 'sistema') return 'Sistema Vethos';
    if (dataset?.miembros) {
      const miembro = dataset.miembros.find((m) => m.uid === actorUid || m.id === actorUid);
      if (miembro?.email) return miembro.email;
    }
    return actorUid.length > 20 ? `${actorUid.substring(0, 10)}...` : actorUid;
  };

  // Resolver nombre de scope / clínica / entidad
  const getScopeNombre = (orgId?: string | null): string => {
    if (!orgId || orgId === 'global') return 'Plataforma Global';
    if (dataset) {
      const vet = dataset.veterinarias.find((v) => v.id === orgId || v.orgId === orgId);
      if (vet?.nombre) return vet.nombre;
      const ent = dataset.entidades.find((e) => e.id === orgId);
      if (ent?.nombre) return ent.nombre;
    }
    return orgId.length > 20 ? `${orgId.substring(0, 10)}...` : orgId;
  };

  const accionesUnicas = useMemo(() => new Set(eventos.map((evento) => evento.accion ?? 'evento')).size, [eventos]);
  const actoresUnicos = useMemo(
    () => new Set(eventos.map((evento) => evento.actorUid ?? 'sistema')).size,
    [eventos],
  );
  const eventosGlobales = useMemo(() => eventos.filter((evento) => !evento.orgId).length, [eventos]);

  // Filtrado reactivo de auditoría
  const filtrados = useMemo(() => {
    return eventos.filter((evento) => {
      const accionTraducida = traducirAccion(evento.accion).toLowerCase();
      const actorNombre = getActorNombre(evento.actorUid).toLowerCase();
      const scopeNombre = getScopeNombre(evento.orgId).toLowerCase();
      const query = busqueda.trim().toLowerCase();

      const coincideTexto =
        !query ||
        accionTraducida.includes(query) ||
        actorNombre.includes(query) ||
        scopeNombre.includes(query);

      if (!coincideTexto) return false;
      if (accionFiltro && evento.accion !== accionFiltro) return false;

      return true;
    });
  }, [eventos, dataset, busqueda, accionFiltro]);

  // Aplicar paginación responsiva universal
  const { page, setPage, pageSize, totalPages, totalItems, pagedItems } = useResponsivePagination(filtrados);

  return (
    <div className="grid gap-5" data-testid="superadmin-auditoria-panel">
      {/* Resumen Superior */}
      <Card className="premium-card">
        <SectionHeader
          title="Historial de Actividades y Registro de Seguridad"
          description="Registro de acciones realizadas en la plataforma por usuarios y veterinarias. Lectura transparente y trazabilidad."
          action={<Badge estado="readonly">Solo lectura</Badge>}
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile
            label="Eventos visibles"
            value={eventos.length}
            hint={`${filtrados.length} coinciden con los filtros`}
            icon={<FileClock className="h-5 w-5" />}
            tone="info"
          />
          <InfoTile
            label="Acciones"
            value={accionesUnicas}
            hint="Tipos de actividad registrados"
            icon={<Activity className="h-5 w-5" />}
            tone="success"
          />
          <InfoTile
            label="Actores"
            value={actoresUnicos}
            hint="Usuarios o sistema"
            icon={<Users className="h-5 w-5" />}
            tone="neutral"
          />
          <InfoTile
            label="Globales"
            value={eventosGlobales}
            hint="Actividades de administración global"
            icon={<ShieldCheck className="h-5 w-5" />}
            tone="warn"
          />
        </div>
      </Card>

      {/* Explorador de Eventos con Tabla y Paginación Responsiva */}
      <Card className="premium-card">
        <SectionHeader
          title="Registro de Actividades"
          description="Filtra eventos en tiempo real y revisa quién realizó cada acción con paginación adaptativa."
        />

        {/* Controles de Búsqueda y Filtros */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            placeholder="🔍 Buscar por acción, usuario/actor o clínica..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={inputStyle}
            className="w-full"
          />
          <select
            value={accionFiltro}
            onChange={(e) => setAccionFiltro(e.target.value)}
            style={inputStyle}
            className="w-full"
          >
            <option value="">Todas las acciones</option>
            {Array.from(new Set(eventos.map((e) => e.accion).filter(Boolean))).map((acc) => (
              <option key={acc} value={acc}>
                {traducirAccion(acc)}
              </option>
            ))}
          </select>
        </div>

        {filtrados.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              variant="controlled"
              titulo="Sin eventos para el filtro seleccionado"
              mensaje="Ajusta el texto de búsqueda o la acción para ampliar la revisión de actividades."
              icon={<Search className="h-5 w-5" />}
            />
          </div>
        ) : (
          <>
            {/* Tabla Estructurada Responsiva */}
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Actividad Realizada</th>
                    <th className="py-3 px-3">Usuario / Actor</th>
                    <th className="py-3 px-3">Sede / Entidad Target</th>
                    <th className="py-3 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {pagedItems.map((evento) => {
                    const accionLegible = traducirAccion(evento.accion);
                    const actorLegible = getActorNombre(evento.actorUid);
                    const scopeLegible = getScopeNombre(evento.orgId);

                    return (
                      <tr key={evento.id} className="hover:bg-[var(--surface-2)] transition-colors">
                        <td className="py-3 px-3">
                          <strong className="text-sm font-bold text-[var(--text)] block">{accionLegible}</strong>
                          <span className="text-[10px] text-[var(--muted)] font-mono">Clave: {evento.accion ?? 'evento'}</span>
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-[var(--text)]">
                          👤 {actorLegible}
                        </td>
                        <td className="py-3 px-3 font-bold text-[var(--text)]">
                          🏥 {scopeLegible}
                        </td>
                        <td className="py-3 px-3">
                          <Badge estado="activa" size="sm">Auditado</Badge>
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
    </div>
  );
};
