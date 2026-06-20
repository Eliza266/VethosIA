/* eslint-disable no-console */
// Prueba FUNCIONAL real de los proveedores de IA con las claves de api/.env.
// No necesita emulador ni HTTP: instancia los adaptadores y hace llamadas reales.
// Reporta por proveedor: OK / CLAVE_INVALIDA / HTTP_xxx / ERROR_RED.
//   Uso: cd api ; npx ts-node scripts/probe-ia.ts
import 'dotenv/config';
import { ClaudeLlmProvider } from '../src/modules/ia/providers/claude-llm.provider';
import { GeminiLlmProvider } from '../src/modules/ia/providers/gemini.providers';
import { GeminiService } from '../src/modules/ia/gemini.service';
import { OpenAiSttProvider } from '../src/modules/ia/providers/openai-stt.provider';
import { extraerJson, normalizarSoap } from '../src/modules/ia/providers/soap.schema';

function clasificar(err: unknown): string {
  const e = err as { response?: { status?: number }; message?: string };
  const status = e?.response?.status;
  if (status === 401 || status === 403) return 'CLAVE_INVALIDA';
  if (status) return `HTTP_${status}`;
  return 'ERROR_RED';
}

// WAV PCM16 mono de silencio (valida auth/forma del STT sin depender de contenido).
function wavSilencio(segundos = 0.4, rate = 16000): Buffer {
  const n = Math.floor(segundos * rate);
  const dataLen = n * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  return buf;
}

const PROMPT =
  'Eres un asistente clinico veterinario. Devuelve SOLO un JSON con este formato ' +
  '{"motivo":"","prioridad":"rutina","signosVitales":{"peso":null,"temperatura":null},"subjetivo":"","objetivo":"","analisis":"","plan":"","medicamentosSugeridos":[]}. ' +
  'Transcripcion: "Perro Max, 4 anios, vomito y diarrea hace 2 dias, decaido. Peso 28 kg, temperatura 39.2."';

async function main(): Promise<void> {
  console.log('=== PROBE IA (llamadas reales) ===');
  console.log('Claves presentes:',
    'ANTHROPIC=', !!process.env.ANTHROPIC_API_KEY,
    'OPENAI=', !!process.env.OPENAI_API_KEY,
    'GEMINI=', !!process.env.GEMINI_API_KEY);

  // Claude (LLM primario): probamos varios nombres de modelo hasta encontrar uno valido,
  // porque el nombre exacto depende de a que modelos tiene acceso la cuenta.
  const candidatosClaude = [
    process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    'claude-sonnet-4-5',
    'claude-3-7-sonnet-latest',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
  ];
  let claudeOk = false;
  for (const modelo of candidatosClaude) {
    process.env.ANTHROPIC_MODEL = modelo;
    try {
      const t = await new ClaudeLlmProvider().completar(PROMPT);
      const j = extraerJson(t);
      console.log(`CLAUDE: OK con modelo='${modelo}' ->`, j ? JSON.stringify({ motivo: normalizarSoap(j, '').motivo }).slice(0, 120) : (t || '').slice(0, 100));
      claudeOk = true;
      break;
    } catch (e) {
      const data = (e as { response?: { data?: unknown } }).response?.data;
      console.log(`CLAUDE: '${modelo}' FALLO`, clasificar(e), JSON.stringify(data ?? (e as Error).message).slice(0, 200));
    }
  }
  if (!claudeOk) console.log('CLAUDE: ningun modelo candidato funciono.');

  // Gemini (fallback LLM)
  try {
    const t = await new GeminiLlmProvider(new GeminiService()).completar(PROMPT);
    const j = extraerJson(t);
    console.log('GEMINI:', j ? 'OK (JSON)' : 'OK (texto)', (t || '').slice(0, 120));
  } catch (e) {
    console.log('GEMINI: FALLO', clasificar(e), (e as Error).message.slice(0, 180));
  }

  // OpenAI STT (primario)
  try {
    const out = await new OpenAiSttProvider().transcribir(wavSilencio().toString('base64'), 'audio/wav');
    console.log('OPENAI_STT: OK (auth valida). Transcripcion:', JSON.stringify(out).slice(0, 120));
  } catch (e) {
    console.log('OPENAI_STT: FALLO', clasificar(e), (e as Error).message.slice(0, 180));
  }
  console.log('=== FIN PROBE ===');
}

void main().then(() => process.exit(0));
