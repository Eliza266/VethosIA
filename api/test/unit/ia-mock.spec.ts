import { validateEnv } from '../../src/common/config/env.schema';
import {
  resolverProveedoresLlm,
  resolverProveedoresStt,
  usaMockLlm,
  usaMockStt,
} from '../../src/modules/ia/providers/resolve-ia-providers';
import { LlmProvider, SttProvider } from '../../src/modules/ia/providers/provider.interface';
import { MockSttProvider } from '../../src/modules/ia/providers/mock-stt.provider';
import { MockLlmProvider } from '../../src/modules/ia/providers/mock-llm.provider';
import { MOCK_TRANSCRIPCION_VET } from '../../src/modules/ia/providers/mock-stt.provider';
import { SoapService } from '../../src/modules/ia/soap.service';
import { SttService } from '../../src/modules/ia/stt.service';

const stt = (nombre: string): SttProvider => ({ nombre, transcribir: async () => nombre });
const llm = (nombre: string): LlmProvider => ({ nombre, completar: async () => nombre });

describe('resolve-ia-providers', () => {
  it('IA_MOCK=true activa mock STT y LLM', () => {
    const env = validateEnv({ IA_MOCK: 'true' } as NodeJS.ProcessEnv);
    expect(usaMockStt(env)).toBe(true);
    expect(usaMockLlm(env)).toBe(true);
    expect(resolverProveedoresStt(env, stt('mock'), stt('openai'), stt('gemini')).map((p) => p.nombre)).toEqual([
      'mock',
    ]);
  });

  it('STT_PROVIDER=mock sin IA_MOCK usa solo mock STT', () => {
    const env = validateEnv({ STT_PROVIDER: 'mock', LLM_PROVIDER: 'anthropic' } as NodeJS.ProcessEnv);
    expect(usaMockStt(env)).toBe(true);
    expect(usaMockLlm(env)).toBe(false);
    const providers = resolverProveedoresStt(env, stt('mock'), stt('openai'), stt('gemini'));
    expect(providers.map((p) => p.nombre)).toEqual(['mock']);
  });

  it('LLM_PROVIDER=mock sin IA_MOCK usa solo mock LLM', () => {
    const env = validateEnv({ STT_PROVIDER: 'openai', LLM_PROVIDER: 'mock' } as NodeJS.ProcessEnv);
    expect(usaMockLlm(env)).toBe(true);
    const providers = resolverProveedoresLlm(env, llm('mock'), llm('claude'), llm('gemini'));
    expect(providers.map((p) => p.nombre)).toEqual(['mock']);
  });

  it('sin mock mantiene orden gemini primero si STT_PROVIDER=gemini', () => {
    const env = validateEnv({ STT_PROVIDER: 'gemini' } as NodeJS.ProcessEnv);
    const providers = resolverProveedoresStt(env, stt('mock'), stt('openai'), stt('gemini'));
    expect(providers.map((p) => p.nombre)).toEqual(['gemini', 'openai']);
  });

  it('sin mock mantiene orden claude primero si LLM_PROVIDER=anthropic', () => {
    const env = validateEnv({ LLM_PROVIDER: 'anthropic' } as NodeJS.ProcessEnv);
    const providers = resolverProveedoresLlm(env, llm('mock'), llm('claude'), llm('gemini'));
    expect(providers.map((p) => p.nombre)).toEqual(['claude', 'gemini']);
  });
});

describe('MockSttProvider', () => {
  it('devuelve transcripcion veterinaria no vacia', async () => {
    const provider = new MockSttProvider();
    const texto = await provider.transcribir('YmFzZTY0', 'audio/webm');
    expect(texto).toBe(MOCK_TRANSCRIPCION_VET);
    expect(texto).toMatch(/canino|vómito|gastroenteritis/i);
  });
});

describe('MockLlmProvider + SoapService', () => {
  it('genera SOAP valido compatible con el esquema actual', async () => {
    const mockLlm = new MockLlmProvider();
    const soapSvc = new SoapService([mockLlm]);
    const soap = await soapSvc.generarSoap(MOCK_TRANSCRIPCION_VET);

    expect(soap.motivo).toMatch(/vómito/i);
    expect(soap.prioridad).toBe('rutina');
    expect(soap.signosVitales.peso).toBe(12);
    expect(soap.signosVitales.temperatura).toBe(38.5);
    expect(soap.diagnosticoEstructurado[0]).toMatchObject({
      nombre: 'Gastroenteritis',
      tipo: 'principal',
      estado: 'presuntivo',
      origen: 'ia',
    });
    expect(soap.medicamentosSugeridos[0]?.nombre).toBe('Omeprazol');
    expect(soap.subjetivo).toBeTruthy();
  });
});

describe('SttService con mock', () => {
  it('transcribe via proveedor mock', async () => {
    const svc = new SttService([new MockSttProvider()]);
    const out = await svc.transcribir('abc', 'audio/webm');
    expect(out).toBe(MOCK_TRANSCRIPCION_VET);
  });
});

describe('validateEnv mock en produccion', () => {
  it('rechaza IA_MOCK en produccion', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        IA_MOCK: 'true',
        ANTHROPIC_API_KEY: 'k',
        OPENAI_API_KEY: 'k',
      } as NodeJS.ProcessEnv),
    ).toThrow(/IA_MOCK/);
  });

  it('rechaza STT_PROVIDER=mock en produccion', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        STT_PROVIDER: 'mock',
        LLM_PROVIDER: 'anthropic',
        ANTHROPIC_API_KEY: 'k',
      } as NodeJS.ProcessEnv),
    ).toThrow(/STT_PROVIDER/);
  });

  it('rechaza LLM_PROVIDER=mock en produccion', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        STT_PROVIDER: 'openai',
        LLM_PROVIDER: 'mock',
        OPENAI_API_KEY: 'k',
      } as NodeJS.ProcessEnv),
    ).toThrow(/LLM_PROVIDER/);
  });

  it('permite IA_MOCK en development sin claves', () => {
    const env = validateEnv({ IA_MOCK: 'true' } as NodeJS.ProcessEnv);
    expect(env.IA_MOCK).toBe(true);
  });
});
