import axios from 'axios';
import { GeminiService } from '../../src/modules/ia/gemini.service';

// Mockeamos axios para no pegarle a Gemini de verdad. Validamos el parsing robusto del JSON
// (con basura alrededor), la normalizacion de tipos y el fallback cuando todo falla.
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function geminiText(text: string): { data: unknown } {
  return { data: { candidates: [{ content: { parts: [{ text }] } }] } };
}

describe('GeminiService', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...OLD_ENV, GEMINI_API_KEY: 'test-key' };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('parsea JSON aunque venga con texto/backticks alrededor', async () => {
    const svc = new GeminiService();
    mockedAxios.post.mockResolvedValueOnce(
      geminiText('Aquí tienes: ```json\n{"motivo":"tos","prioridad":"urgente","subjetivo":"x"}\n``` listo'),
    );
    const soap = await svc.generarSoap('el perro tose');
    expect(soap.motivo).toBe('tos');
    expect(soap.prioridad).toBe('urgente');
    expect(soap.subjetivo).toBe('x');
    // signos vitales siempre presentes y normalizados a null.
    expect(soap.signosVitales.peso).toBeNull();
    expect(Array.isArray(soap.medicamentosSugeridos)).toBe(true);
  });

  it('normaliza prioridad invalida a "rutina" y numeros desde strings', async () => {
    const svc = new GeminiService();
    mockedAxios.post.mockResolvedValueOnce(
      geminiText('{"motivo":"x","prioridad":"loquesea","signosVitales":{"peso":"12.5"}}'),
    );
    const soap = await svc.generarSoap('t');
    expect(soap.prioridad).toBe('rutina');
    expect(soap.signosVitales.peso).toBe(12.5);
  });

  it('cae al fallback si Gemini nunca devuelve JSON valido', async () => {
    const svc = new GeminiService();
    mockedAxios.post.mockResolvedValue(geminiText('no soy json'));
    const soap = await svc.generarSoap('transcripcion cruda');
    // el fallback mete la transcripcion en subjetivo (igual que hace hoy el front).
    expect(soap.subjetivo).toBe('transcripcion cruda');
    expect(soap.prioridad).toBe('rutina');
  });

  it('transcribe devolviendo el texto recortado', async () => {
    const svc = new GeminiService();
    mockedAxios.post.mockResolvedValueOnce(geminiText('  el paciente presenta fiebre  '));
    const out = await svc.transcribir('YmFzZTY0', 'audio/webm');
    expect(out).toBe('el paciente presenta fiebre');
  });
});
