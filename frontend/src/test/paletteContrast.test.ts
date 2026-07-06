import { describe, it, expect } from 'vitest';
import { contrastRatio } from '../lib/contrast';

/**
 * Fundamenta la accesibilidad de la paleta clara (dirección C).
 * Los valores deben coincidir con los tokens de `src/index.css`.
 * AA: 4.5 texto normal, 3.0 texto grande / componentes.
 */
const TOKENS = {
  surface: '#ffffff',
  bg: '#f6f8f7',
  text: '#101613',
  textSecondary: '#3a4541',
  muted: '#646f6b',
  accent: '#072040',
  accentStrong: '#072540',
  accentContrast: '#ffffff',
} as const;

describe('contraste de la paleta (WCAG AA)', () => {
  it('texto principal sobre superficie cumple AAA', () => {
    expect(contrastRatio(TOKENS.text, TOKENS.surface)).toBeGreaterThanOrEqual(7);
  });

  it('texto secundario sobre superficie cumple AA', () => {
    expect(contrastRatio(TOKENS.textSecondary, TOKENS.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('texto muted sobre superficie cumple AA (texto normal)', () => {
    expect(contrastRatio(TOKENS.muted, TOKENS.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('texto muted sobre fondo de app cumple AA', () => {
    expect(contrastRatio(TOKENS.muted, TOKENS.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('texto de contraste sobre acento (boton primario) cumple AA', () => {
    expect(contrastRatio(TOKENS.accentContrast, TOKENS.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('acento como texto/enlace sobre superficie cumple AA', () => {
    expect(contrastRatio(TOKENS.accent, TOKENS.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('acento fuerte sobre superficie cumple AAA', () => {
    expect(contrastRatio(TOKENS.accentStrong, TOKENS.surface)).toBeGreaterThanOrEqual(7);
  });
});
