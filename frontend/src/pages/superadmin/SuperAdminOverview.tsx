import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Building2, Hospital, Users } from 'lucide-react';
import { Card, KpiCard, SectionHeader } from '../../components/ui/Primitives';
import type { SuperAdminDataset } from './types';
import { consumoLabel, isVeterinario } from './utils';

export const SuperAdminOverview: React.FC<{ data: SuperAdminDataset }> = ({ data }) => {
  const veterinarios = data.miembros.filter(isVeterinario);
  const alertas =
    data.miembros.filter((m) => m.bloqueado || m.estado === 'bloqueado').length +
    data.solicitudes.filter((s) => s.estado === 'pendiente').length;

  return (
    <div className="grid gap-5" data-testid="superadmin-overview-panel">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Entidades" value={data.entidades.length} icon={<Building2 />} />
        <KpiCard label="Veterinarias" value={data.veterinarias.length} icon={<Hospital />} />
        <KpiCard label="Miembros" value={data.miembros.length} hint={`${veterinarios.length} veterinarios`} icon={<Users />} />
        <KpiCard label="Consumo global" value={consumoLabel(data.consumos)} icon={<AlertTriangle />} accent={alertas > 0 ? 'warn' : 'success'} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="premium-card">
          <SectionHeader
            title="Mapa operativo de plataforma"
            description="Accesos directos a módulos reales de administración global. Cada módulo conserva RBAC server-side."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ['Entidades', '/admin?panel=entidades', 'Alta, detalle, estado, sedes y consumo asociado.'],
              ['Veterinarias', '/admin?panel=veterinarias', 'Sedes globales, miembros vinculados y scope entidad.'],
              ['Usuarios', '/admin?panel=usuarios', 'Roles V2, bloqueo/reactivación y self-damage bloqueado.'],
              ['Planes', '/planes', 'Catálogo comercial sin activar pagos reales.'],
              ['Suscripciones', '/suscripciones', 'Estado, vigencia, owner y uso/consumo.'],
              ['Pagos', '/admin?panel=pagos', 'Estado Wompi server-side y checkout no habilitado globalmente.'],
              ['Auditoría', '/auditoria', 'Eventos críticos y trazabilidad.'],
              ['Configuración', '/configuracion', 'Defaults operativos e integraciones en modo seguro.'],
            ].map(([label, to, copy]) => (
              <Link key={label} to={to} className="premium-card premium-card-hover block p-4">
                <strong className="text-[var(--text)]">{label}</strong>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{copy}</p>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="premium-card">
          <SectionHeader title="Riesgo operativo" description="Lectura consolidada sin ejecutar acciones externas." />
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Alertas</p>
              <strong className="mt-1 block text-2xl text-[var(--text)]">{alertas}</strong>
              <p className="mt-1 text-sm text-[var(--muted)]">Usuarios bloqueados + solicitudes técnicas pendientes.</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Facturación</p>
              <strong className="mt-1 block text-2xl text-[var(--text)]">{data.suscripciones.length}</strong>
              <p className="mt-1 text-sm text-[var(--muted)]">Suscripciones observadas. Wompi real no se activa desde esta consola.</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">Auditoría</p>
              <strong className="mt-1 block text-2xl text-[var(--text)]">{data.auditoria.length}</strong>
              <p className="mt-1 text-sm text-[var(--muted)]">Eventos recientes listados por API.</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};
