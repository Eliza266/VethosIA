/** Nombres genéricos del bootstrap API; no usarlos como etiqueta visible. */
const GENERIC_DISPLAY_NAMES = new Set(['veterinario']);

export function isGenericDisplayName(nombre: string | null | undefined): boolean {
  if (!nombre?.trim()) return true;
  return GENERIC_DISPLAY_NAMES.has(nombre.trim().toLowerCase());
}

/** Etiqueta visible: nombre real, si no email, si no "Usuario". */
export function displayUserLabel(input: {
  nombre?: string | null;
  email?: string | null;
}): string {
  const nombre = input.nombre?.trim();
  if (nombre && !isGenericDisplayName(nombre)) return nombre;
  const email = input.email?.trim();
  if (email) return email;
  return 'Usuario';
}
