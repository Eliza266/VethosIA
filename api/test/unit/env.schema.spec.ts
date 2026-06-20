import { DEV_INVITE_SECRET, validateEnv } from '../../src/common/config/env.schema';

const STRONG_INVITE_SECRET = 'invite-secret-produccion-valido-test-only-48-chars';
const STRONG_WORKER_SECRET = 'worker-secret-produccion-min-32-chars';

// Validacion de entorno: defaults sanos en dev, coercion de tipos y fail-fast en prod.
describe('validateEnv', () => {
  it('aplica defaults razonables con env minima', () => {
    const env = validateEnv({} as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(8080);
    expect(env.API_PREFIX).toBe('v1');
    expect(env.QUEUE_DRIVER).toBe('inmemory');
    expect(env.STT_PROVIDER).toBe('openai');
    expect(env.LLM_PROVIDER).toBe('anthropic');
    expect(env.SESSION_INACTIVITY_HOURS).toBe(8);
    expect(env.INVITE_SECRET).toBe(DEV_INVITE_SECRET);
  });

  it('coerce PORT string a number', () => {
    const env = validateEnv({ PORT: '3000' } as unknown as NodeJS.ProcessEnv);
    expect(env.PORT).toBe(3000);
  });

  it('rechaza QUEUE_DRIVER invalido', () => {
    expect(() => validateEnv({ QUEUE_DRIVER: 'kafka' } as unknown as NodeJS.ProcessEnv)).toThrow(
      /QUEUE_DRIVER/,
    );
  });

  it('rechaza PORT no numerico', () => {
    expect(() => validateEnv({ PORT: 'abc' } as unknown as NodeJS.ProcessEnv)).toThrow(/PORT/);
  });

  it('en produccion exige INVITE_SECRET', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        LLM_PROVIDER: 'anthropic',
        STT_PROVIDER: 'openai',
        ANTHROPIC_API_KEY: 'k',
        OPENAI_API_KEY: 'k',
        IA_WORKER_SECRET: STRONG_WORKER_SECRET,
      } as NodeJS.ProcessEnv),
    ).toThrow(/INVITE_SECRET/);
  });

  it('en produccion rechaza INVITE_SECRET corto', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        LLM_PROVIDER: 'anthropic',
        STT_PROVIDER: 'openai',
        ANTHROPIC_API_KEY: 'k',
        OPENAI_API_KEY: 'k',
        IA_WORKER_SECRET: STRONG_WORKER_SECRET,
        INVITE_SECRET: 'corto',
      } as NodeJS.ProcessEnv),
    ).toThrow(/INVITE_SECRET/);
  });

  it('en produccion rechaza el default dev de INVITE_SECRET', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        LLM_PROVIDER: 'anthropic',
        STT_PROVIDER: 'openai',
        ANTHROPIC_API_KEY: 'k',
        OPENAI_API_KEY: 'k',
        IA_WORKER_SECRET: STRONG_WORKER_SECRET,
        INVITE_SECRET: DEV_INVITE_SECRET,
      } as NodeJS.ProcessEnv),
    ).toThrow(/INVITE_SECRET/);
  });

  it('en test permite el default dev de INVITE_SECRET', () => {
    const env = validateEnv({ NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    expect(env.INVITE_SECRET).toBe(DEV_INVITE_SECRET);
  });

  it('en produccion exige ANTHROPIC_API_KEY si LLM_PROVIDER=anthropic', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        LLM_PROVIDER: 'anthropic',
        STT_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'g',
        IA_WORKER_SECRET: STRONG_WORKER_SECRET,
        INVITE_SECRET: STRONG_INVITE_SECRET,
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/ANTHROPIC_API_KEY/);
  });

  it('en produccion exige IA_WORKER_URL si QUEUE_DRIVER=cloudtasks', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        LLM_PROVIDER: 'gemini',
        STT_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'g',
        QUEUE_DRIVER: 'cloudtasks',
        IA_WORKER_SECRET: STRONG_WORKER_SECRET,
        INVITE_SECRET: STRONG_INVITE_SECRET,
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow(/IA_WORKER_URL/);
  });

  it('produccion contra emulador es permisiva con proveedores, pero exige INVITE_SECRET fuerte', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
      INVITE_SECRET: STRONG_INVITE_SECRET,
    } as unknown as NodeJS.ProcessEnv);
    expect(env.NODE_ENV).toBe('production');
  });

  it('en produccion exige IA_WORKER_SECRET min 32 chars', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        LLM_PROVIDER: 'anthropic',
        STT_PROVIDER: 'openai',
        ANTHROPIC_API_KEY: 'k',
        OPENAI_API_KEY: 'k',
        INVITE_SECRET: STRONG_INVITE_SECRET,
      } as NodeJS.ProcessEnv),
    ).toThrow(/IA_WORKER_SECRET/);
  });

  it('produccion completa y valida pasa', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      LLM_PROVIDER: 'anthropic',
      STT_PROVIDER: 'openai',
      ANTHROPIC_API_KEY: 'sk-ant-x',
      OPENAI_API_KEY: 'sk-openai-x',
      QUEUE_DRIVER: 'cloudtasks',
      IA_WORKER_URL: 'https://run.app/v1/ia/procesar',
      IA_WORKER_SECRET: STRONG_WORKER_SECRET,
      INVITE_SECRET: STRONG_INVITE_SECRET,
    } as unknown as NodeJS.ProcessEnv);
    expect(env.LLM_PROVIDER).toBe('anthropic');
  });
});
