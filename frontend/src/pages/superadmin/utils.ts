import type React from 'react';
import type { BackofficeConsumo, BackofficeEntidad, BackofficeMiembro } from '../../features/backoffice/api';
import type { EntidadDraft } from './types';

export const inputStyle: React.CSSProperties = {
  minWidth: 0,
  padding: 10,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)',
  color: 'var(--text)',
};

export const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: 10,
};

export const itemStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 14,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,251,252,0.88))',
};

export const lineStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
};

export function text(value: unknown, fallback = 'Sin dato'): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export function optionalText(value: string): string | undefined {
  const clean = value.trim();
  return clean.length > 0 ? clean : undefined;
}

export function isVeterinario(miembro: BackofficeMiembro): boolean {
  return miembro.role === 'veterinario' || miembro.rol === 'vet';
}

export function estadoMiembro(miembro: BackofficeMiembro): string {
  if (miembro.bloqueado) return 'bloqueado';
  return miembro.estado ?? 'activo';
}

export function esCuentaActual(
  me: { uid?: string | null; membershipId?: string | null } | undefined,
  miembro: BackofficeMiembro,
): boolean {
  return Boolean((me?.uid && me.uid === miembro.uid) || (me?.membershipId && me.membershipId === miembro.id));
}

export function sumarConsumo(consumos: BackofficeConsumo[]): { usados: number; limite: number } {
  return consumos.reduce(
    (acc, consumo) => ({
      usados: acc.usados + (Number.isFinite(consumo.usados) ? consumo.usados : 0),
      limite: acc.limite + (typeof consumo.limite === 'number' && consumo.limite > 0 ? consumo.limite : 0),
    }),
    { usados: 0, limite: 0 },
  );
}

export function consumoLabel(consumos: BackofficeConsumo[]): string {
  const total = sumarConsumo(consumos);
  return `${total.usados}${total.limite > 0 ? `/${total.limite}` : ''}`;
}

export function statusFromRecord(value: Record<string, unknown>): string {
  return text(value.estado ?? value.status, 'sin_estado');
}

export function planOwnerLabel(value: Record<string, unknown>): string {
  return text(value.planOwnerId ?? value.veterinarioId ?? value.orgId ?? value.id);
}

export function resolvePlanName(
  planId: unknown,
  planes: Array<{ id: string; nombre: string }>,
): string {
  if (!planId || typeof planId !== 'string') return 'Trial Gratuito / Clínica Start';
  const cleanId = planId.trim();
  const found = planes.find(
    (p) => p.id === cleanId || p.nombre.toLowerCase() === cleanId.toLowerCase(),
  );
  if (found) return found.nombre;
  // Si el planId es un hash técnico largo (ej: jljetjC0ixysHjz32IX3), mapear a nombre legible
  if (cleanId.length > 12 && !cleanId.includes(' ')) {
    return 'Clínica Pro (Comercial)';
  }
  return cleanId;
}

export function resolveOwnerName(
  suscripcion: Record<string, unknown>,
  dataset?: {
    veterinarias?: Array<{ id: string; nombre: string; planOwnerId?: string; orgId?: string | null }>;
    entidades?: Array<{ id: string; nombre: string; planOwnerId?: string; legacyOrgId?: string | null }>;
    miembros?: Array<{ id: string; uid: string; email?: string | null }>;
  },
): string {
  const ownerId = String(
    suscripcion.planOwnerId ?? suscripcion.veterinariaId ?? suscripcion.orgId ?? suscripcion.id ?? '',
  );
  if (!ownerId) return 'Sin propietario';

  if (dataset?.veterinarias) {
    const vet = dataset.veterinarias.find(
      (v) => v.id === ownerId || v.planOwnerId === ownerId || v.orgId === ownerId,
    );
    if (vet) return vet.nombre;
  }

  if (dataset?.entidades) {
    const ent = dataset.entidades.find(
      (e) => e.id === ownerId || e.planOwnerId === ownerId || e.legacyOrgId === ownerId,
    );
    if (ent) return ent.nombre;
  }

  if (dataset?.miembros) {
    const m = dataset.miembros.find((u) => u.id === ownerId || u.uid === ownerId);
    if (m) return m.email ?? m.uid;
  }

  return ownerId;
}

export function entidadToDraft(entidad: BackofficeEntidad): EntidadDraft {
  return {
    nombre: entidad.nombre,
    tipo: entidad.tipo ?? '',
    direccion: entidad.direccion ?? '',
    ciudad: entidad.ciudad ?? '',
    pais: entidad.pais ?? '',
    telefono: entidad.telefono ?? '',
    emailContacto: entidad.emailContacto ?? '',
    logoUrl: entidad.logoUrl ?? '',
    estado: entidad.estado,
  };
}

export function entidadPayload(input: EntidadDraft) {
  return {
    nombre: input.nombre.trim(),
    tipo: input.tipo || undefined,
    direccion: optionalText(input.direccion),
    ciudad: optionalText(input.ciudad),
    pais: optionalText(input.pais),
    telefono: optionalText(input.telefono),
    emailContacto: optionalText(input.emailContacto),
    logoUrl: optionalText(input.logoUrl),
    estado: input.estado,
  };
}

export function parseFirebaseDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'object') {
    const obj = val as { seconds?: number; _seconds?: number };
    if (typeof obj.seconds === 'number') return new Date(obj.seconds * 1000);
    if (typeof obj._seconds === 'number') return new Date(obj._seconds * 1000);
  }
  return null;
}

export function formatFechaRegistro(val: unknown, fallback = 'Sin fecha'): string {
  const d = parseFirebaseDate(val);
  if (!d) return fallback;
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface TiempoTrialResult {
  dias: number;
  horas: number;
  minutos: number;
  expirado: boolean;
  esTrial: boolean;
  esDePago: boolean;
  textoDetallado: string;
  badgeTexto: string;
  badgeEstado: 'success' | 'warning' | 'danger' | 'info' | 'default';
}

export function calcularTiempoTrialRestante(
  trialHastaVal: unknown,
  creadoEnVal?: unknown,
  estadoVal?: unknown,
): TiempoTrialResult {
  const estadoStr = String(estadoVal || '').toLowerCase();

  if (estadoStr === 'activa' || estadoStr === 'pagada' || estadoStr === 'suscripto') {
    return {
      dias: 0,
      horas: 0,
      minutos: 0,
      expirado: false,
      esTrial: false,
      esDePago: true,
      textoDetallado: 'Plan de pago activo',
      badgeTexto: '💳 Plan de Pago Activo',
      badgeEstado: 'success',
    };
  }

  let trialEnd: Date | null = parseFirebaseDate(trialHastaVal);
  if (!trialEnd && creadoEnVal) {
    const creadoDate = parseFirebaseDate(creadoEnVal);
    if (creadoDate) {
      trialEnd = new Date(creadoDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  if (!trialEnd) {
    return {
      dias: 0,
      horas: 0,
      minutos: 0,
      expirado: false,
      esTrial: false,
      esDePago: false,
      textoDetallado: 'Sin información de trial',
      badgeTexto: 'Sin trial',
      badgeEstado: 'default',
    };
  }

  const now = new Date();
  const diffMs = trialEnd.getTime() - now.getTime();

  if (diffMs <= 0) {
    const haceMs = Math.abs(diffMs);
    const haceDias = Math.floor(haceMs / (1000 * 60 * 60 * 24));
    const haceHoras = Math.floor((haceMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const tiempoHace = haceDias > 0 ? `${haceDias}d ${haceHoras}h` : `${haceHoras}h`;

    return {
      dias: 0,
      horas: 0,
      minutos: 0,
      expirado: true,
      esTrial: true,
      esDePago: false,
      textoDetallado: `Prueba finalizada hace ${tiempoHace}`,
      badgeTexto: `⏱️ Vencido (hace ${tiempoHace})`,
      badgeEstado: 'danger',
    };
  }

  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const textoDetallado = `${dias} ${dias === 1 ? 'día' : 'días'}, ${horas} ${horas === 1 ? 'hora' : 'horas'} restantes`;
  const badgeTexto = `⏱️ ${dias}d ${horas}h restantes`;
  const badgeEstado = dias <= 1 ? 'warning' : 'info';

  return {
    dias,
    horas,
    minutos,
    expirado: false,
    esTrial: true,
    esDePago: false,
    textoDetallado,
    badgeTexto,
    badgeEstado,
  };
}
