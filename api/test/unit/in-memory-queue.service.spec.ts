import { InMemoryQueueService } from '../../src/modules/ia/queue/in-memory-queue.service';
import { IaJob } from '../../src/modules/ia/queue/queue.interface';
import { IaProcessor } from '../../src/modules/ia/queue/ia-processor';

const job = (over: Partial<IaJob> = {}): IaJob => ({ consultaId: 'c1', ...over });

// Procesa la cola in-memory hasta vaciar los timers pendientes (backoff exponencial).
async function drain(): Promise<void> {
  // Cada reintento agenda un setTimeout; corremos todos los timers y dejamos resolver microtasks.
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  }
}

describe('InMemoryQueueService (reintentos)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('procesa el job una vez si no falla', async () => {
    const procesar = jest.fn(async () => undefined);
    const queue = new InMemoryQueueService();
    queue.registerProcessor({ procesar } as unknown as IaProcessor);

    await queue.enqueue(job());
    await drain();
    expect(procesar).toHaveBeenCalledTimes(1);
  });

  it('reintenta tras un fallo transitorio y termina OK', async () => {
    const procesar = jest
      .fn()
      .mockRejectedValueOnce(new Error('transitorio'))
      .mockResolvedValueOnce(undefined);
    const queue = new InMemoryQueueService();
    queue.registerProcessor({ procesar } as unknown as IaProcessor);

    await queue.enqueue(job());
    await drain();
    expect(procesar).toHaveBeenCalledTimes(2);
    // el segundo intento llevó intento=1
    expect((procesar.mock.calls[1][0] as IaJob).intento).toBe(1);
  });

  it('se rinde tras agotar maxIntentos (3) sin loop infinito', async () => {
    const procesar = jest.fn(async () => {
      throw new Error('siempre falla');
    });
    const queue = new InMemoryQueueService();
    queue.registerProcessor({ procesar } as unknown as IaProcessor);

    await queue.enqueue(job());
    await drain();
    // intentos: 0, 1, 2 => 3 llamadas y para (no reintenta el 3ro)
    expect(procesar).toHaveBeenCalledTimes(3);
  });

  it('descarta el job (sin crashear) si no hay procesador registrado', async () => {
    const queue = new InMemoryQueueService();
    await expect(queue.enqueue(job())).resolves.toBeUndefined();
    await drain();
  });
});
