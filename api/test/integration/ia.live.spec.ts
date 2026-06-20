import 'dotenv/config';
import { SoapService } from '../../src/modules/ia/soap.service';
import { GeminiLlmProvider } from '../../src/modules/ia/providers/gemini.providers';
import { GeminiService } from '../../src/modules/ia/gemini.service';

// Prueba de integracion REAL del pipeline SOAP (llama a Gemini de verdad). Por costo/red,
// solo corre si RUN_LIVE_IA=1 y hay GEMINI_API_KEY; si no, se salta.
const correrLive = process.env.RUN_LIVE_IA === '1' && !!process.env.GEMINI_API_KEY;
const d = correrLive ? describe : describe.skip;

d('IA live - SOAP real (Gemini)', () => {
  it('estructura una transcripcion en SOAP valido', async () => {
    const svc = new SoapService([new GeminiLlmProvider(new GeminiService())]);
    const soap = await svc.generarSoap(
      'Perro Max, 4 anios, vomito y diarrea hace 2 dias, decaido. Peso 28 kg, temperatura 39.2.',
    );
    expect(soap).toHaveProperty('motivo');
    expect(soap).toHaveProperty('subjetivo');
    expect(soap.signosVitales).toHaveProperty('peso');
    expect(['urgente', 'rutina', 'seguimiento', 'brigada']).toContain(soap.prioridad);
  }, 30_000);
});
