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
