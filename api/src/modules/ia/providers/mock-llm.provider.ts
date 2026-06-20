import { Injectable } from '@nestjs/common';
import { LlmProvider } from './provider.interface';
import { MOCK_TRANSCRIPCION_VET } from './mock-stt.provider';

// SOAP mock compatible con soap.schema.ts / SoapResult del frontend.
const MOCK_SOAP = {
  motivo: 'Vómito desde ayer tras ingestión de basura',
  prioridad: 'rutina' as const,
  signosVitales: {
    peso: 12,
    temperatura: 38.5,
    frecuenciaCardiaca: 100,
    frecuenciaRespiratoria: null,
    condicionCorporal: null,
  },
  subjetivo:
    'Canino mestizo de 4 años. Propietario reporta vómito desde ayer tras comer basura en el parque.',
  objetivo: 'Abdomen blando, mucosas rosadas, temperatura 38.5 °C, peso 12 kg, FC 100 lpm.',
  analisis: 'Gastroenteritis presuntiva por ingestión de material extraño.',
  plan: 'Ayuno 12 horas. Omeprazol 10 mg VO cada 12 h por 5 días. Control en 48 h si persiste vómito.',
  diagnosticoEstructurado: [
    {
      id: 'diag-mock-gastroenteritis',
      nombre: 'Gastroenteritis',
      tipo: 'principal',
      estado: 'presuntivo',
      especie: 'canino',
      sistema: 'digestivo',
      codigo: 'gastroenteritis',
      notas: 'Sugerida por IA mock a partir de vomito tras ingesta de basura.',
      origen: 'ia',
      creadoEn: '2026-01-01T00:00:00.000Z',
    },
  ],
  medicamentosSugeridos: [
    {
      nombre: 'Omeprazol',
      dosis: '10 mg',
      via: 'VO',
      frecuencia: 'cada 12 horas',
      duracion: '5 días',
      indicacion: 'Gastroenteritis',
    },
  ],
};

@Injectable()
export class MockLlmProvider implements LlmProvider {
  readonly nombre = 'mock';

  async completar(_prompt: string): Promise<string> {
    // Si el prompt incluye otra transcripcion (p. ej. reintento), preservamos subjetivo coherente.
    const transcripcion = extraerTranscripcion(_prompt) ?? MOCK_TRANSCRIPCION_VET;
    const soap = {
      ...MOCK_SOAP,
      subjetivo: transcripcion,
    };
    return JSON.stringify(soap);
  }
}

function extraerTranscripcion(prompt: string): string | null {
  const match = prompt.match(/Transcripci[oó]n:\s*\n?"([^"]+)"/i);
  return match?.[1]?.trim() ?? null;
}
