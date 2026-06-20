/** Cuentas demo/smoke conocidas por dominio o prefijo; no toca claims ni backend. */
export function isDemoSession(input: { email?: string | null } | null | undefined): boolean {
  const email = input?.email?.trim().toLowerCase() ?? '';
  if (!email) return false;
  return (
    email.endsWith('@vethosia.test') ||
    email.startsWith('demo.') ||
    email.includes('.demo.')
  );
}

export const DEMO_ACTION_HINT =
  'Modo demo: esta acción está protegida para cuentas de demostración y no persiste cambios reales.';
