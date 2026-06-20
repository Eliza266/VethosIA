import { describe, it, expect } from 'vitest';

// GUARDIA DE SEGURIDAD: el bundle del cliente NUNCA debe contener claves de proveedores de
// IA/pagos ni llamadas directas a sus endpoints. Si alguien reintroduce VITE_*_API_KEY de un
// proveedor o pega directo a Gemini/OpenAI/Anthropic desde el front, este test FALLA.
// Usamos import.meta.glob (Vite) para leer el fuente sin depender de APIs de Node.
const PATRONES_PROHIBIDOS: Array<[string, RegExp]> = [
  ['VITE_GEMINI_API_KEY', /VITE_GEMINI_API_KEY/],
  ['VITE_OPENAI_API_KEY', /VITE_OPENAI_API_KEY/],
  ['VITE_ANTHROPIC_API_KEY', /VITE_ANTHROPIC_API_KEY/],
  ['gemini endpoint', /generativelanguage\.googleapis\.com/],
  ['openai endpoint', /api\.openai\.com/],
  ['anthropic endpoint', /api\.anthropic\.com/],
];

const fuentes = import.meta.glob('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('seguridad: sin claves de IA en el cliente', () => {
  it('ningun archivo fuente del frontend referencia claves/endpoints de proveedores', () => {
    const ofensores: string[] = [];
    for (const [ruta, contenido] of Object.entries(fuentes)) {
      if (ruta.includes('noClientAiKeys.test')) continue; // este archivo contiene los patrones
      for (const [nombre, patron] of PATRONES_PROHIBIDOS) {
        if (patron.test(contenido)) ofensores.push(`${ruta} -> ${nombre}`);
      }
    }
    expect(ofensores).toEqual([]);
  });
});
