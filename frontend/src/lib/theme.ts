/**
 * Constantes de marca para contextos donde `var(--css)` no resuelve como valor
 * (p. ej. atributos SVG/recharts: stroke/fill pasados directamente al SVG).
 * Deben coincidir con los tokens de `src/index.css`.
 * En CSS (className / style) usa SIEMPRE las variables `var(--accent)`, no estas constantes.
 */
export const BRAND = {
  accent: '#0f6e56',
  accentStrong: '#0a5341',
  accentSoft: '#e6f4ef',
  info: '#1d4ed8',
  success: '#15803d',
  warn: '#b45309',
  danger: '#b91c1c',
  muted: '#646f6b',
  text: '#101613',
  border: '#e3e8e6',
} as const;

/**
 * Lee una variable CSS del :root en runtime (para charts que prefieran el token vivo).
 * Devuelve `fallback` si no hay DOM o la variable está vacía.
 */
export function getCssVar(name: string, fallback = ''): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return value.trim() || fallback;
}
