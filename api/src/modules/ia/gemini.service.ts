import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { GeminiConfig, loadGeminiConfig } from '../../common/config/env';
import {
  GeminiRequest,
  GeminiResponse,
  SoapResult,
  SignosVitalesIa,
  PrioridadIa,
  MedicamentoSugerido,
} from './interfaces/gemini.interface';
import { normalizarDiagnosticosEstructurados } from '../consultas/diagnostico-estructurado';

// Cliente de Gemini server-side. Los prompts y el parsing robusto del JSON se copiaron
// 1:1 de frontend/src/services/gemini.ts y whisper.ts, pero ahora la API key vive en el
// servidor (GEMINI_API_KEY), no en el navegador.
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly cfg: GeminiConfig = loadGeminiConfig();

  private url(): string {
    return `${this.cfg.baseUrl}/models/${this.cfg.model}:generateContent?key=${this.cfg.apiKey}`;
  }

  private assertKey(): void {
    if (!this.cfg.apiKey) {
      throw new Error('GEMINI_API_KEY no configurada en el servidor.');
    }
  }

  private async generate(req: GeminiRequest): Promise<string> {
    const { data } = await axios.post<GeminiResponse>(this.url(), req, {
      headers: { 'Content-Type': 'application/json' },
    });
    const candidates = data?.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No se recibió respuesta de Gemini.');
    }
    return candidates[0].content?.parts?.[0]?.text ?? '';
  }

  // ── Transcripcion ─────────────────────────────────────────
  // Mismo prompt que whisper.ts. Recibe el audio en base64 + su mimeType.
  async transcribir(audioBase64: string, mimeType: string): Promise<string> {
    this.assertKey();
    const req: GeminiRequest = {
      contents: [
        {
          parts: [
            {
              text: 'Transcribe exactamente lo que se dice en este audio de una consulta veterinaria. Solo devuelve la transcripción, sin comentarios adicionales.',
            },
            { inlineData: { mimeType: mimeType || 'audio/webm', data: audioBase64 } },
          ],
        },
      ],
    };
    const texto = await this.generate(req);
    return texto.trim();
  }

  // ── SOAP ──────────────────────────────────────────────────
  // Mismo prompt que generateSOAP. Devuelve SIEMPRE un SoapResult bien formado: si el
  // parseo falla reintenta con prompt simplificado y, en ultimo caso, cae a un fallback
  // con la transcripcion en "subjetivo" (igual que hace hoy el front).
  async generarSoap(transcripcion: string): Promise<SoapResult> {
    this.assertKey();
    const prompt = this.promptSoap(transcripcion);

    try {
      const texto = await this.generate({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
      });
      const parsed = this.parseJson(texto);
      if (parsed) return this.normalizar(parsed, transcripcion);

      // reintento con prompt minimalista (mismo approach del front).
      const simple = `Extrae esta transcripción en un objeto JSON con este formato estricto sin texto adicional: {"motivo":"","prioridad":"rutina","signosVitales":{},"subjetivo":"","objetivo":"","analisis":"","plan":"","diagnosticoEstructurado":[],"medicamentosSugeridos":[]}. Transcripción: "${transcripcion}"`;
      const retry = await this.generate({
        contents: [{ parts: [{ text: simple }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
      });
      const parsedRetry = this.parseJson(retry);
      if (parsedRetry) return this.normalizar(parsedRetry, transcripcion);

      return this.fallback(transcripcion);
    } catch (err) {
      this.logger.warn(`Gemini SOAP fallo, usando fallback: ${(err as Error).message}`);
      return this.fallback(transcripcion);
    }
  }

  // Generacion de texto cruda a partir de un prompt (la usa el adaptador LlmProvider de
  // Gemini; el parsing/validacion del SOAP lo hace SoapService, no aca).
  async completarTexto(prompt: string): Promise<string> {
    this.assertKey();
    return this.generate({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
    });
  }

  private promptSoap(transcription: string): string {
    return `Eres un asistente clínico veterinario experto. Analiza la transcripción de una consulta veterinaria y extrae toda la información disponible.

INSTRUCCIONES:
- Usa ÚNICAMENTE la información presente en la transcripción
- No inventes datos que no se mencionaron
- Si un dato no se menciona, usa null
- Usa terminología veterinaria clínica apropiada
- En el Plan incluye medicamentos con nombre, dosis, vía, frecuencia y duración

Devuelve ÚNICAMENTE un objeto JSON válido sin comentarios ni backticks:
{
  "motivo": "motivo principal de la consulta en una línea",
  "prioridad": "urgente|rutina|seguimiento|brigada",
  "signosVitales": {
    "peso": null,
    "temperatura": null,
    "frecuenciaCardiaca": null,
    "frecuenciaRespiratoria": null,
    "condicionCorporal": null
  },
  "subjetivo": "síntomas y anamnesis reportados",
  "objetivo": "hallazgos del examen físico",
  "analisis": "diagnóstico presuntivo o diferencial",
  "plan": "tratamiento completo con medicamentos y dosis",
  "diagnosticoEstructurado": [
    {
      "id": "identificador corto estable",
      "nombre": "nombre del diagnostico sugerido",
      "tipo": "principal|diferencial|secundario",
      "estado": "presuntivo|confirmado|descartado",
      "especie": "especie si aplica",
      "sistema": "sistema corporal si aplica",
      "codigo": "codigo o slug opcional",
      "notas": "motivo breve de la sugerencia",
      "origen": "ia",
      "creadoEn": "ISO-8601"
    }
  ],
  "medicamentosSugeridos": [
    {
      "nombre": "",
      "dosis": "",
      "via": "",
      "frecuencia": "",
      "duracion": "",
      "indicacion": ""
    }
  ]
}

Transcripción:
"${transcription}"
`;
  }

  // Parseo robusto: primero intenta sacar el primer bloque {...} con regex (Gemini a veces
  // mete texto o backticks alrededor), si no limpia los fences. Devuelve null si no hay JSON.
  private parseJson(text: string): Record<string, unknown> | null {
    if (!text) return null;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as Record<string, unknown>;
      const limpio = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      return JSON.parse(limpio) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  // Normaliza el objeto crudo a SoapResult tipado (sin 'any'), rellenando lo que falte.
  private normalizar(raw: Record<string, unknown>, transcripcion: string): SoapResult {
    const str = (v: unknown, def = ''): string => (typeof v === 'string' ? v : def);
    const numOrNull = (v: unknown): number | null =>
      typeof v === 'number' ? v : v === null || v === undefined || v === '' ? null : Number(v) || null;

    const sv = (raw.signosVitales ?? {}) as Record<string, unknown>;
    const signosVitales: SignosVitalesIa = {
      peso: numOrNull(sv.peso),
      temperatura: numOrNull(sv.temperatura),
      frecuenciaCardiaca: numOrNull(sv.frecuenciaCardiaca),
      frecuenciaRespiratoria: numOrNull(sv.frecuenciaRespiratoria),
      condicionCorporal: numOrNull(sv.condicionCorporal),
    };

    const meds = Array.isArray(raw.medicamentosSugeridos) ? raw.medicamentosSugeridos : [];
    const medicamentosSugeridos: MedicamentoSugerido[] = meds.map((m) => {
      const o = (m ?? {}) as Record<string, unknown>;
      return {
        nombre: str(o.nombre),
        dosis: str(o.dosis),
        via: str(o.via),
        frecuencia: str(o.frecuencia),
        duracion: str(o.duracion),
        indicacion: str(o.indicacion),
      };
    });

    return {
      motivo: str(raw.motivo, 'Consulta registrada'),
      prioridad: this.prioridad(raw.prioridad),
      signosVitales,
      subjetivo: str(raw.subjetivo, transcripcion),
      objetivo: str(raw.objetivo),
      analisis: str(raw.analisis),
      plan: str(raw.plan),
      diagnosticoEstructurado: normalizarDiagnosticosEstructurados(raw.diagnosticoEstructurado, {
        strict: false,
        origenDefault: 'ia',
      }),
      medicamentosSugeridos,
    };
  }

  private prioridad(v: unknown): PrioridadIa {
    return v === 'urgente' || v === 'rutina' || v === 'seguimiento' || v === 'brigada'
      ? v
      : 'rutina';
  }

  // Igual que el catch del front: no rompemos el flujo, devolvemos la transcripcion cruda.
  private fallback(transcripcion: string): SoapResult {
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
}
