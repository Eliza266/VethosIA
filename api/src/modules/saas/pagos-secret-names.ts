import { createHash } from 'crypto';

export type WompiSecretKind = 'public' | 'private' | 'events' | 'integrity';

/** Id seguro para nombres de secretos en GCP (solo metadata en Firestore). */
export function sanitizePlanOwnerId(planOwnerId: string): string {
  const raw = planOwnerId.trim();
  if (!raw) {
    throw new Error('planOwnerId es obligatorio para configurar secretos Wompi.');
  }
  const sanitized = raw
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 12);
  const base = sanitized || `owner_${hash}`;
  return base.length > 180 ? `${base.slice(0, 180)}_${hash}` : base;
}

export function wompiSecretResourceName(planOwnerId: string, kind: WompiSecretKind): string {
  return `vetia-wompi-${sanitizePlanOwnerId(planOwnerId)}-${kind}`;
}
