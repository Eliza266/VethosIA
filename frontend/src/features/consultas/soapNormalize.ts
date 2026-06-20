import type { ResultadoSOAP, MedicamentoSugerido, SignosVitales } from '../../types';
import { normalizarDiagnosticosEstructurados } from './diagnosticos';

// Helpers PUROS de normalizacion del SOAP (sin claves ni red). Antes vivian en
// services/gemini.ts junto a la llamada a Gemini (que exponia la API key en el navegador).
// Ahora la IA vive 100% server-side (/v1/ia/*); aqui solo queda la normalizacion del shape
// que devuelve la API, reutilizable y testeable.

const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

const PRIORIDADES = ['urgente', 'rutina', 'seguimiento', 'brigada'] as const;
const asPrioridad = (v: unknown): ResultadoSOAP['prioridad'] =>
  (PRIORIDADES as readonly string[]).includes(v as string)
    ? (v as ResultadoSOAP['prioridad'])
    : 'rutina';

const asNumberOrUndef = (v: unknown): number | undefined =>
  typeof v === 'number' && !Number.isNaN(v) ? v : undefined;

export const parseGeminiJSON = (textResponse: string): unknown | null => {
  if (!textResponse) return null;
  try {
    const match = textResponse.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {
    /* seguimos con el limpiado de fences */
  }
  try {
    const cleaned = textResponse
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
};

const normalizeSignos = (raw: unknown): SignosVitales => {
  const s = (raw ?? {}) as Record<string, unknown>;
  const out: SignosVitales = {};
  const peso = asNumberOrUndef(s.peso);
  const talla = asNumberOrUndef(s.talla ?? s.altura);
  const temperatura = asNumberOrUndef(s.temperatura);
  const fc = asNumberOrUndef(s.frecuenciaCardiaca);
  const fr = asNumberOrUndef(s.frecuenciaRespiratoria);
  const cc = asNumberOrUndef(s.condicionCorporal);
  if (peso !== undefined) out.peso = peso;
  if (talla !== undefined) out.talla = talla;
  if (temperatura !== undefined) out.temperatura = temperatura;
  if (fc !== undefined) out.frecuenciaCardiaca = fc;
  if (fr !== undefined) out.frecuenciaRespiratoria = fr;
  if (cc !== undefined) out.condicionCorporal = cc as SignosVitales['condicionCorporal'];
  return out;
};

const normalizeMeds = (raw: unknown): MedicamentoSugerido[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const med = (m ?? {}) as Record<string, unknown>;
    return {
      nombre: asString(med.nombre),
      dosis: asString(med.dosis),
      via: asString(med.via),
      frecuencia: asString(med.frecuencia),
      duracion: asString(med.duracion),
      indicacion: asString(med.indicacion),
    };
  });
};

export const normalizeResultadoSOAP = (raw: unknown, generadoPorIA: boolean): ResultadoSOAP => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const diagnosticoEstructurado = normalizarDiagnosticosEstructurados(r.diagnosticoEstructurado);
  return {
    motivo: asString(r.motivo),
    prioridad: asPrioridad(r.prioridad),
    signosVitales: normalizeSignos(r.signosVitales),
    subjetivo: asString(r.subjetivo),
    objetivo: asString(r.objetivo),
    analisis: asString(r.analisis),
    plan: asString(r.plan),
    diagnosticoEstructurado,
    medicamentosSugeridos: normalizeMeds(r.medicamentosSugeridos),
    generadoPorIA,
  };
};

export const buildFallbackResultado = (transcription: string): ResultadoSOAP => ({
  motivo: 'Consulta registrada (no estructurada)',
  prioridad: 'rutina',
  signosVitales: {},
  subjetivo: transcription,
  objetivo: '',
  analisis: '',
  plan: '',
  diagnosticoEstructurado: [],
  medicamentosSugeridos: [],
  generadoPorIA: false,
});
