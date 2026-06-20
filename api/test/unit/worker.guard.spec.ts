import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { WorkerGuard } from '../../src/modules/ia/worker.guard';
import { validateEnv } from '../../src/common/config/env.schema';

function ctx(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ header: (h: string) => headers[h.toLowerCase()] }),
    }),
  } as unknown as ExecutionContext;
}

describe('WorkerGuard (fail-closed)', () => {
  const OLD = process.env;
  afterEach(() => {
    process.env = OLD;
  });

  it('con secreto: header correcto pasa, incorrecto 401', () => {
    process.env = { ...OLD, IA_WORKER_SECRET: 's3cr3t-super-largo-para-produccion-ok', QUEUE_DRIVER: 'inmemory' };
    const g = new WorkerGuard();
    expect(g.canActivate(ctx({ 'x-worker-secret': 's3cr3t-super-largo-para-produccion-ok' }))).toBe(true);
    expect(() => g.canActivate(ctx({ 'x-worker-secret': 'malo' }))).toThrow(UnauthorizedException);
    expect(() => g.canActivate(ctx({}))).toThrow(UnauthorizedException);
  });

  it('secreto corto en PROD: 401', () => {
    process.env = {
      ...OLD,
      IA_WORKER_SECRET: 'corto',
      NODE_ENV: 'production',
      FIRESTORE_EMULATOR_HOST: '',
    };
    const g = new WorkerGuard();
    expect(() => g.canActivate(ctx({ 'x-worker-secret': 'corto' }))).toThrow(/demasiado corto/i);
  });

  it('sin secreto en dev: pasa', () => {
    process.env = { ...OLD, IA_WORKER_SECRET: '', NODE_ENV: 'development' };
    const g = new WorkerGuard();
    expect(g.canActivate(ctx({}))).toBe(true);
  });

  it('sin secreto en PROD: 401 aunque haya Authorization Bearer (Run publico)', () => {
    process.env = { ...OLD, IA_WORKER_SECRET: '', NODE_ENV: 'production', FIRESTORE_EMULATOR_HOST: '' };
    const g = new WorkerGuard();
    expect(() => g.canActivate(ctx({}))).toThrow(/obligatorio/i);
    expect(() => g.canActivate(ctx({ authorization: 'Bearer eyJhbG.a.b' }))).toThrow(/obligatorio/i);
  });

  it('PROD mal configurada sin secreto: boot schema falla', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        LLM_PROVIDER: 'anthropic',
        STT_PROVIDER: 'openai',
        ANTHROPIC_API_KEY: 'k',
        OPENAI_API_KEY: 'k',
        QUEUE_DRIVER: 'cloudtasks',
        IA_WORKER_URL: 'https://run.app/v1/ia/procesar',
      } as NodeJS.ProcessEnv),
    ).toThrow(/IA_WORKER_SECRET/);
  });
});
