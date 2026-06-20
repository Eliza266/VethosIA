import { Injectable, Logger } from '@nestjs/common';
import { CloudTasksClient } from '@google-cloud/tasks';
import { IaJob, IaQueue } from './queue.interface';
import { loadAppConfig, loadQueueConfig, QueueConfig } from '../../../common/config/env';

// Adaptador de Cloud Tasks para prod. Encola un HTTP task que hace POST a /v1/ia/procesar
// (el worker, este mismo servicio en Cloud Run). Cloud Tasks se encarga de los reintentos,
// rate limiting y dead-lettering segun la config de la cola.
//
// PENDIENTE de ejecutar en cloud: requiere una cola creada (gcloud tasks queues create) y
// permisos del service account. Aqui queda el codigo listo; en este entorno no se puede
// crear la cola ni autenticar contra GCP, por eso el default sigue siendo InMemoryQueue.
@Injectable()
export class CloudTasksQueueService implements IaQueue {
  private readonly logger = new Logger(CloudTasksQueueService.name);
  private readonly client = new CloudTasksClient();
  private readonly cfg: QueueConfig = loadQueueConfig();
  private readonly projectId = loadAppConfig().projectId;

  async enqueue(job: IaJob): Promise<void> {
    if (!this.cfg.workerUrl) {
      throw new Error('IA_WORKER_URL no configurada para Cloud Tasks.');
    }
    const parent = this.client.queuePath(this.projectId, this.cfg.location, this.cfg.queueName);
    const body = Buffer.from(JSON.stringify(job)).toString('base64');

    // si hay service account, usamos OIDC para que el worker valide el token;
    // si no, mandamos un header con el secreto compartido (modo simple).
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.cfg.workerSecret) {
      headers['x-worker-secret'] = this.cfg.workerSecret;
    }

    await this.client.createTask({
      parent,
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url: `${this.cfg.workerUrl}`,
          headers,
          body,
          ...(this.cfg.invokerServiceAccount
            ? { oidcToken: { serviceAccountEmail: this.cfg.invokerServiceAccount } }
            : {}),
        },
      },
    });
    this.logger.log(`Job encolado en Cloud Tasks para consulta=${job.consultaId}`);
  }
}
