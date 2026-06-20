import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDERS, LlmProvider } from './providers/provider.interface';
import { SoapResult } from './interfaces/gemini.interface';
import { extraerJson, normalizarSoap, soapFallback } from './providers/soap.schema';

// Estructura una transcripcion en SOAP. UN SOLO prompt server-side (elimina la duplicacion
// frontend/API). Flujo: prompt -> parse JSON -> validar/normalizar con zod. Si falla,
// reintenta con prompt simple; si el proveedor primario truena, cae al fallback provider;
// si todo falla, devuelve un SOAP fallback con la transcripcion en subjetivo (no inventa).
@Injectable()
export class SoapService {
  private readonly logger = new Logger(SoapService.name);

  constructor(@Inject(LLM_PROVIDERS) private readonly providers: LlmProvider[]) {}

  async generarSoap(transcripcion: string): Promise<SoapResult> {
    for (const provider of this.providers) {
      try {
        const soap = await this.intentarConProveedor(provider, transcripcion);
        if (soap) return soap;
      } catch (err) {
        this.logger.warn(`LLM ${provider.nombre} fallo: ${(err as Error).message}. Fallback.`);
      }
    }
    this.logger.warn('Todos los LLM fallaron; usando SOAP fallback.');
    return soapFallback(transcripcion);
  }

  private async intentarConProveedor(
    provider: LlmProvider,
    transcripcion: string,
  ): Promise<SoapResult | null> {
    const texto = await provider.completar(this.promptCompleto(transcripcion));
    const parsed = extraerJson(texto);
    if (parsed) return normalizarSoap(parsed, transcripcion);

    // reintento con prompt minimalista (mismo approach del front legacy).
    const retry = await provider.completar(this.promptSimple(transcripcion));
    const parsedRetry = extraerJson(retry);
    if (parsedRetry) return normalizarSoap(parsedRetry, transcripcion);

    return null;
  }

  private promptCompleto(transcripcion: string): string {
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
    { "nombre": "", "dosis": "", "via": "", "frecuencia": "", "duracion": "", "indicacion": "" }
  ]
}

Transcripción:
"${transcripcion}"
`;
  }

  private promptSimple(transcripcion: string): string {
    return `Extrae esta transcripción en un objeto JSON con este formato estricto sin texto adicional: {"motivo":"","prioridad":"rutina","signosVitales":{},"subjetivo":"","objetivo":"","analisis":"","plan":"","diagnosticoEstructurado":[],"medicamentosSugeridos":[]}. Transcripción: "${transcripcion}"`;
  }
}
