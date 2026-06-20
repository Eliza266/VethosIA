import { z } from 'zod';
import { SoapResult } from '../interfaces/gemini.interface';
import { normalizarDiagnosticosEstructurados } from '../../consultas/diagnostico-estructurado';

// Esquema zod del SOAP: garantiza la forma final (sin 'any') y normaliza tipos laxos
// que a veces devuelve el modelo (numeros como string, null, etc.).

const numOrNull = z.preprocess((v) => {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}, z.number().nullable());

const strDef = (def = '') =>
  z.preprocess((v) => (typeof v === 'string' ? v : v == null ? def : String(v)), z.string());

export const signosVitalesSchema = z.object({
  peso: numOrNull,
  temperatura: numOrNull,
  frecuenciaCardiaca: numOrNull,
  frecuenciaRespiratoria: numOrNull,
  condicionCorporal: numOrNull,
});

export const medicamentoSchema = z.object({
  nombre: strDef(),
  dosis: strDef(),
  via: strDef(),
  frecuencia: strDef(),
  duracion: strDef(),
  indicacion: strDef(),
});

export const prioridadSchema = z.preprocess(
  (v) => (v === 'urgente' || v === 'rutina' || v === 'seguimiento' || v === 'brigada' ? v : 'rutina'),
  z.enum(['urgente', 'rutina', 'seguimiento', 'brigada']),
);

export const soapSchema = z.object({
  motivo: strDef('Consulta registrada'),
  prioridad: prioridadSchema,
  // si falta o no es objeto, normalizamos a {} (que produce todos los signos en null).
  signosVitales: z.preprocess(
    (v) => (v && typeof v === 'object' ? v : {}),
    signosVitalesSchema,
  ),
  subjetivo: strDef(),
  objetivo: strDef(),
  analisis: strDef(),
  plan: strDef(),
  diagnosticoEstructurado: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(z.record(z.string(), z.unknown())),
  ),
  medicamentosSugeridos: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(medicamentoSchema),
  ),
});

// Intenta extraer el primer bloque {...} del texto del modelo (a veces viene con backticks
// o texto alrededor). Devuelve null si no hay JSON parseable.
export function extraerJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as Record<string, unknown>;
    const limpio = text
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    return JSON.parse(limpio) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Valida + normaliza el objeto crudo contra el esquema. Rellena lo que falte. Si subjetivo
// queda vacio, cae a la transcripcion (no inventamos, solo preservamos lo dicho).
export function normalizarSoap(raw: unknown, transcripcion: string): SoapResult {
  const parsed = soapSchema.safeParse(raw ?? {});
  const base = parsed.success ? parsed.data : soapSchema.parse({});
  return {
    ...base,
    subjetivo: base.subjetivo || transcripcion,
    diagnosticoEstructurado: normalizarDiagnosticosEstructurados(base.diagnosticoEstructurado, {
      origenDefault: 'ia',
      strict: false,
    }),
  };
}

// Fallback total: no rompemos el flujo, devolvemos la transcripcion cruda en subjetivo.
export function soapFallback(transcripcion: string): SoapResult {
  return {
    motivo: 'Consulta registrada (no estructurada)',
    prioridad: 'rutina',
    signosVitales: {
      peso: null,
      temperatura: null,
      frecuenciaCardiaca: null,
      frecuenciaRespiratoria: null,
      condicionCorporal: null,
    },
    subjetivo: transcripcion,
    objetivo: '',
    analisis: '',
    plan: '',
    diagnosticoEstructurado: [],
    medicamentosSugeridos: [],
  };
}
