import { Env } from '../../../common/config/env.schema';
import { LlmProvider, SttProvider } from './provider.interface';

// Resuelve si usar mock STT/LLM segun env. IA_MOCK=true activa ambos; tambien se puede
// elegir mock por proveedor individual (STT_PROVIDER=mock / LLM_PROVIDER=mock).
export function usaMockStt(env: Pick<Env, 'IA_MOCK' | 'STT_PROVIDER'>): boolean {
  return env.IA_MOCK || env.STT_PROVIDER === 'mock';
}

export function usaMockLlm(env: Pick<Env, 'IA_MOCK' | 'LLM_PROVIDER'>): boolean {
  return env.IA_MOCK || env.LLM_PROVIDER === 'mock';
}

export function resolverProveedoresStt(
  env: Pick<Env, 'IA_MOCK' | 'STT_PROVIDER'>,
  mock: SttProvider,
  openai: SttProvider,
  gemini: SttProvider,
): SttProvider[] {
  if (usaMockStt(env)) return [mock];
  return env.STT_PROVIDER === 'gemini' ? [gemini, openai] : [openai, gemini];
}

export function resolverProveedoresLlm(
  env: Pick<Env, 'IA_MOCK' | 'LLM_PROVIDER'>,
  mock: LlmProvider,
  claude: LlmProvider,
  gemini: LlmProvider,
): LlmProvider[] {
  if (usaMockLlm(env)) return [mock];
  return env.LLM_PROVIDER === 'gemini' ? [gemini, claude] : [claude, gemini];
}
