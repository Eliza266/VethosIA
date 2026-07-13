const TRIAL_START = new Date('2026-07-14T00:00:00-05:00');
const TRIAL_END = new Date('2026-07-21T23:59:59-05:00');

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

const formatoFecha = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Bogota',
});

export function getTrialBannerMessage(now: Date = new Date()): string | null {
  if (now < TRIAL_START) {
    return `Tu prueba gratuita de 8 días comienza el martes ${formatoFecha.format(TRIAL_START)} y finaliza el martes ${formatoFecha.format(TRIAL_END)}.`;
  }
  if (now <= TRIAL_END) {
    const diasRestantes = Math.max(1, Math.ceil((TRIAL_END.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    const plural = diasRestantes === 1 ? 'día' : 'días';
    return `Estás en tu prueba gratuita — finaliza el martes ${formatoFecha.format(TRIAL_END)}. Quedan ${diasRestantes} ${plural}.`;
  }
  return null;
}
