import React from 'react';
import { Badge, Card, EmptyState, SectionHeader } from '../../components/ui/Primitives';
import type { SystemConfigPublicView } from '../../features/plataforma/api';

export const ConfiguracionPanel: React.FC<{ config?: SystemConfigPublicView; isLoading?: boolean }> = ({
  config,
  isLoading,
}) => {
  const defaults = config?.defaults;
  const integrations = config?.integrations;
  return (
    <div className="grid gap-5" data-testid="superadmin-configuracion-panel">
      <Card className="premium-card">
        <SectionHeader
          title="Configuración global"
          description="Vista read-only segura de defaults y flags operativos. No activa integraciones ni scheduler."
        />
        {!config && !isLoading ? (
          <EmptyState
            variant="controlled"
            titulo="Configuración no disponible"
            mensaje="La API no devolvió configuración segura de plataforma. La consola queda en modo cerrado hasta recibir defaults válidos."
          />
        ) : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ConfigTile label="Trial/gracia" value={`${defaults?.suscripcionDiasGracia ?? '-'} días`} hint="Gracia lógica para suscripciones." />
          <ConfigTile label="Alerta consumo" value={`${defaults?.consumoAlertaPorcentaje ?? '-'}%`} hint="Umbral operativo de alerta." />
          <ConfigTile label="Citas" value={`${defaults?.citaProximaHoras ?? '-'}h / ${defaults?.citaDiaAnteriorHoras ?? '-'}h`} hint="Ventanas de recordatorio." />
          <ConfigTile label="Invitaciones" value={`${defaults?.invitacionTtlHoras ?? '-'}h`} hint="TTL operativo de enlaces." />
        </div>
      </Card>

      <Card className="premium-card">
        <SectionHeader title="Integraciones" description="Estado seguro: lectura, sin secretos y sin llamadas reales." />
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <IntegrationTile title="Email" status={integrations?.email.mode ?? 'unknown'} copy={integrations?.email.realProviderConfigured ? 'Proveedor server-side configurado.' : 'Proveedor real no configurado o modo mock/controlado.'} />
          <IntegrationTile title="WhatsApp" status={integrations?.whatsapp.mode ?? 'unknown'} copy="Solo link seguro; API real deshabilitada." />
          <IntegrationTile title="Wompi" status={integrations?.wompi.globalSecretsPresent ? 'server-side' : 'pendiente'} copy="Checkout global deshabilitado; secretos no se exponen ni se solicitan desde esta pantalla." />
          <IntegrationTile title="Jobs" status={integrations?.jobs.queueDriver ?? 'unknown'} copy={`Scheduler auto-run: ${integrations?.jobs.schedulerAutoRunEnabled ? 'activo' : 'deshabilitado'}. Guard: ${integrations?.jobs.workerGuard ?? 'n/a'}.`} />
        </div>
        {config?.notes?.length ? (
          <ul className="mt-4 grid gap-2 text-sm text-[var(--muted)]">
            {config.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        ) : null}
      </Card>
    </div>
  );
};

const ConfigTile: React.FC<{ label: string; value: string; hint: string }> = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
    <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
    <strong className="mt-1 block text-xl text-[var(--text)]">{value}</strong>
    <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>
  </div>
);

const IntegrationTile: React.FC<{ title: string; status: string; copy: string }> = ({ title, status, copy }) => (
  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
    <div className="flex items-center justify-between gap-3">
      <strong>{title}</strong>
      <Badge estado={status}>{status}</Badge>
    </div>
    <p className="mt-2 text-sm text-[var(--muted)]">{copy}</p>
  </div>
);
