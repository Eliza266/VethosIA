// Tipos del payload de Gemini. La convencion prohibe 'any', asi que tipamos tanto lo que
// mandamos como lo que volvemos a parsear.

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // base64
  };
}

export interface GeminiContent {
  parts: GeminiPart[];
}

export interface GeminiGenerationConfig {
  responseMimeType?: string;
}

export interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: GeminiGenerationConfig;
}

export interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

// ── Salida SOAP ─────────────────────────────────────────────
// MISMA forma que devuelve hoy generateSOAP en el frontend (frontend/src/services/gemini.ts).
// El frontend nuevo solo cambia el origen del dato, no el shape: respetar al pie de la letra.
export interface MedicamentoSugerido {
  nombre: string;
  dosis: string;
  via: string;
  frecuencia: string;
  duracion: string;
  indicacion: string;
}

export interface SignosVitalesIa {
  peso: number | null;
  temperatura: number | null;
  frecuenciaCardiaca: number | null;
  frecuenciaRespiratoria: number | null;
  condicionCorporal: number | null;
}

export type PrioridadIa = 'urgente' | 'rutina' | 'seguimiento' | 'brigada';

export interface DiagnosticoEstructuradoIa {
  id: string;
  nombre: string;
  tipo: 'principal' | 'diferencial' | 'secundario';
  estado: 'presuntivo' | 'confirmado' | 'descartado';
  especie?: string;
  sistema?: string;
  codigo?: string;
  notas?: string;
  origen: 'ia' | 'manual';
  creadoEn: string;
  actualizadoEn?: string;
}

export interface SoapResult {
  motivo: string;
  prioridad: PrioridadIa;
  signosVitales: SignosVitalesIa;
  subjetivo: string;
  objetivo: string;
  analisis: string;
  plan: string;
  diagnosticoEstructurado: DiagnosticoEstructuradoIa[];
  medicamentosSugeridos: MedicamentoSugerido[];
}
