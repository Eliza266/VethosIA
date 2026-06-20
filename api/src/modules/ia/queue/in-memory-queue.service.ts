import { Injectable, Logger } from '@nestjs/common';
import { IaJob, IaQueue } from './queue.interface';
import { IaProcessor } from './ia-processor';

// Cola en memoria para dev/emulador/tests. Procesa el job en background (no bloquea la
// respuesta) y reintenta con backoff. OJO: si el proceso se cae, el job se pierde; esto NO
// es para prod (para eso esta CloudTasksQueue). Sirve para que todo el pipeline async
// funcione end-to-end sin depender de infra de cloud.
//
// El procesador (IaService) se registra despues con registerProcessor() en vez de
// inyectarse en el constructor: asi evitamos el ciclo de DI Queue <-> IaService.
@Injectable()
export class InMemoryQueueService implements IaQueue {
  private readonly logger = new Logger(InMemoryQueueService.name);
  private readonly maxIntentos = 3;
  private processor?: IaProcessor;

  registerProcessor(processor: IaProcessor): void {
    this.processor = processor;
  }

  async enqueue(job: IaJob): Promise<void> {
    // no await: devolvemos control ya y procesamos aparte (simula el worker).
    void this.run({ ...job, intento: job.intento ?? 0 });
  }

  private async run(job: IaJob): Promise<void> {
    if (!this.processor) {
      this.logger.error('No hay procesador registrado; el job se descarta.');
      return;
    }
    try {
      await this.processor.procesar(job);
    } catch (err) {
      const intento = (job.intento ?? 0) + 1;
      if (intento >= this.maxIntentos) {
        this.logger.error(
          `Job consulta=${job.consultaId} agoto reintentos (${intento}): ${(err as Error).message}`,
        );
        return;
      }
      // backoff exponencial simple antes de reintentar.
      const delay = 500 * 2 ** intento;
      this.logger.warn(`Reintentando job consulta=${job.consultaId} (intento ${intento}) en ${delay}ms`);
      setTimeout(() => void this.run({ ...job, intento }), delay);
    }
  }
}
