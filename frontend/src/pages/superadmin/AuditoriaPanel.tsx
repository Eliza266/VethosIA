import React, { useMemo, useState } from 'react';
import { Activity, FileClock, Search, ShieldCheck, Users } from 'lucide-react';
import { Badge, Card, EmptyState, InfoTile, SectionHeader } from '../../components/ui/Primitives';
import type { BackofficeAuditoria } from '../../features/backoffice/api';
import { inputStyle, text } from './utils';

export const AuditoriaPanel: React.FC<{ eventos: BackofficeAuditoria[] }> = ({ eventos }) => {
  const [accion, setAccion] = useState('');
  const [actor, setActor] = useState('');
  const [org, setOrg] = useState('');
  const accionesUnicas = useMemo(() => new Set(eventos.map((evento) => evento.accion ?? 'evento')).size, [eventos]);
  const actoresUnicos = useMemo(
    () => new Set(eventos.map((evento) => evento.actorUid ?? 'sistema')).size,
    [eventos],
  );
  const eventosGlobales = useMemo(() => eventos.filter((evento) => !evento.orgId).length, [eventos]);
  const filtrados = useMemo(
    () =>
      eventos.filter((evento) => {
        return (
          (!accion || String(evento.accion ?? '').toLowerCase().includes(accion.toLowerCase())) &&
          (!actor || String(evento.actorUid ?? '').toLowerCase().includes(actor.toLowerCase())) &&
          (!org || String(evento.orgId ?? '').toLowerCase().includes(org.toLowerCase()))
        );
      }),
    [accion, actor, eventos, org],
  );

  return (
    <div className="grid gap-5" data-testid="superadmin-auditoria-panel">
      <Card className="premium-card">
        <SectionHeader
          title="Auditoría"
          description="Trazabilidad global en modo lectura. Filtra eventos sin exponer datos sensibles ni ejecutar acciones."
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
            hint="Tipos de evento registrados"
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
            hint="Sin tenant asociado"
            icon={<ShieldCheck className="h-5 w-5" />}
            tone="warn"
          />
        </div>
      </Card>

      <Card className="premium-card">
        <SectionHeader
          title="Explorador de eventos"
          description="Vista compacta para revisión de soporte. Los filtros son locales y no modifican registros."
        />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <FilterField
            label="Acción"
            ariaLabel="Filtrar auditoría por acción"
            value={accion}
            onChange={setAccion}
            placeholder="Ej. paciente.crear"
          />
          <FilterField
            label="Actor"
            ariaLabel="Filtrar auditoría por actor"
            value={actor}
            onChange={setActor}
            placeholder="UID o sistema"
          />
          <FilterField
            label="Entidad / org"
            ariaLabel="Filtrar auditoría por entidad u org"
            value={org}
            onChange={setOrg}
            placeholder="Scope"
          />
        </div>

        {filtrados.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              variant="controlled"
              titulo="Sin eventos para este filtro"
              mensaje="La auditoría sigue disponible; ajusta acción, actor o scope para ampliar la revisión."
              icon={<Search className="h-5 w-5" />}
            />
          </div>
        ) : (
          <>
            <div className="mt-5 hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-[var(--surface-2)] text-[10px] font-black uppercase tracking-[0.14em] text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Recurso</th>
                    <th className="px-4 py-3">Scope</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.slice(0, 80).map((evento) => (
                    <tr key={evento.id} className="border-t border-[var(--border)] transition-colors hover:bg-[var(--surface-2)]">
                      <td className="px-4 py-3 font-black text-[var(--text)]">{evento.accion ?? 'evento'}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-[var(--text-secondary)]">
                        {text(evento.actorUid, 'sistema')}
                      </td>
                      <td className="max-w-[260px] truncate px-4 py-3 text-[var(--muted)]">
                        {text(evento.recurso ?? evento.id)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge estado="neutral">{evento.orgId ?? 'global'}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge estado="activa" size="sm">auditado</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="mt-5 grid gap-3 lg:hidden">
              {filtrados.slice(0, 40).map((evento) => (
                <li key={evento.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <strong className="text-sm text-[var(--text)]">{evento.accion ?? 'evento'}</strong>
                    <Badge estado="neutral">{evento.orgId ?? 'global'}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">Actor {text(evento.actorUid, 'sistema')}</p>
                  <p className="mt-1 break-all text-xs text-[var(--muted)]">Recurso {text(evento.recurso ?? evento.id)}</p>
                </li>
              ))}
            </ul>

            {filtrados.length > 80 ? (
              <p className="mt-3 text-xs text-[var(--muted)]">
                Se muestran los primeros 80 eventos filtrados para mantener la revisión escaneable.
              </p>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
};

function FilterField({
  label,
  ariaLabel,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">
      {label}
      <input
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}
