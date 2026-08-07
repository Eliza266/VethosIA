import { type Veterinario } from '../types';

// Cuentas internas de Vethos (equipo/pruebas): no ven el aviso de prueba gratuita.
const INTERNAL_TEST_EMAILS = new Set([
  'nicovet@vethosia.com',
  'veterinario@vethosia.com',
  'admin.veterinaria@vethosia.com',
  'admin.entidad@vethosia.com',
]);

export function isInternalTestAccount(email?: string | null): boolean {
  if (!email) return false;
  return INTERNAL_TEST_EMAILS.has(email.trim().toLowerCase());
}

export function getTrialBannerMessage(user: Veterinario | null, now: Date = new Date()): string | null {
  if (!user || !user.creadoEn) return null;

  const TRIAL_DAYS = 7;
  // Sumamos 7 días a la fecha de creación
  const trialEnd = new Date(user.creadoEn.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  if (now <= trialEnd) {
    const diasRestantes = Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    const plural = diasRestantes === 1 ? 'día' : 'días';
    return `Estás en tu prueba gratuita de ${TRIAL_DAYS} días. Quedan ${diasRestantes} ${plural}.`;
  }
  
  return null;
}
