import { describe, it, expect } from 'vitest';

/**
 * Guard: el color de marca no debe estar hardcodeado en componentes/páginas.
 * Debe usarse el token (`var(--accent)` o las utilidades Tailwind `accent`/`accent-strong`).
 * Excepciones legítimas: el módulo de tema, la prueba de contraste y este propio test.
 */
const BRAND_HEX = /#072040|#072540/i;
const ALLOWLIST = ['theme.ts', 'paletteContrast.test.ts', 'noHardcodedBrand.test.ts', 'chartColors.ts'];

const modules = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('no hay color de marca hardcodeado', () => {
  it('ningun .ts/.tsx usa #072040 / #072540 literal (salvo allowlist)', () => {
    const ofensores = Object.entries(modules)
      .filter(([path]) => !ALLOWLIST.some((name) => path.endsWith(name)))
      .filter(([, content]) => BRAND_HEX.test(content))
      .map(([path]) => path);
    expect(ofensores, `Usar token de marca, no hex. Ofensores:\n${ofensores.join('\n')}`).toEqual([]);
  });
});
